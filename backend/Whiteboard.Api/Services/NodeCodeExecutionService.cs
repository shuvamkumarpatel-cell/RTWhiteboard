using System.Diagnostics;
using System.Text;
using Whiteboard.Api.Contracts;

namespace Whiteboard.Api.Services;

public sealed class NodeCodeExecutionService : ICodeExecutionService
{
    private static readonly TimeSpan ExecutionTimeout = TimeSpan.FromSeconds(8);

    public async Task<RunCodeResponse> ExecuteAsync(RunCodeRequest request, CancellationToken cancellationToken)
    {
        var normalizedLanguage = request.Language.Trim().ToLowerInvariant();
        var extension = normalizedLanguage switch
        {
            "javascript" => ".mjs",
            "typescript" => ".ts",
            _ => null
        };

        if (extension is null)
        {
            return new RunCodeResponse(
                false,
                -1,
                string.Empty,
                $"Running {request.Language} is not supported yet. Use JavaScript or TypeScript.");
        }

        var tempDirectory = Path.Combine(Path.GetTempPath(), "rtwhiteboard-runs");
        Directory.CreateDirectory(tempDirectory);

        var filePath = Path.Combine(tempDirectory, $"{Guid.NewGuid():N}{extension}");
        await File.WriteAllTextAsync(filePath, request.Code, Encoding.UTF8, cancellationToken);

        try
        {
            var arguments = extension == ".ts"
                ? $"--experimental-strip-types \"{filePath}\""
                : $"\"{filePath}\"";

            using var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "node",
                    Arguments = arguments,
                    RedirectStandardInput = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    StandardOutputEncoding = Encoding.UTF8,
                    StandardErrorEncoding = Encoding.UTF8
                }
            };

            process.Start();

            if (!string.IsNullOrEmpty(request.Input))
            {
                await process.StandardInput.WriteAsync(request.Input);
            }

            process.StandardInput.Close();

            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeoutCts.CancelAfter(ExecutionTimeout);

            var outputTask = process.StandardOutput.ReadToEndAsync(timeoutCts.Token);
            var errorTask = process.StandardError.ReadToEndAsync(timeoutCts.Token);
            var waitTask = process.WaitForExitAsync(timeoutCts.Token);

            try
            {
                await Task.WhenAll(outputTask, errorTask, waitTask);
            }
            catch (OperationCanceledException)
            {
                if (!process.HasExited)
                {
                    process.Kill(entireProcessTree: true);
                }

                return new RunCodeResponse(
                    false,
                    -1,
                    string.Empty,
                    "Execution timed out after 8 seconds.");
            }

            var output = await outputTask;
            var error = await errorTask;

            return new RunCodeResponse(
                process.ExitCode == 0,
                process.ExitCode,
                output,
                error);
        }
        catch (Exception exception)
        {
            return new RunCodeResponse(
                false,
                -1,
                string.Empty,
                exception.Message);
        }
        finally
        {
            if (File.Exists(filePath))
            {
                File.Delete(filePath);
            }
        }
    }
}
