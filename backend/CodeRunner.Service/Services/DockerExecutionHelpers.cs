using System.Diagnostics;
using System.Text;
using Microsoft.Extensions.Options;
using CodeRunner.Service.Contracts;

namespace CodeRunner.Service.Services;

internal static class DockerExecutionHelpers
{
    private static readonly UTF8Encoding Utf8WithoutBom = new(encoderShouldEmitUTF8Identifier: false);

    public static async Task<RunCodeResponse> RunInContainerAsync(
        string languageDisplayName,
        string languageKey,
        string fileName,
        string code,
        string? input,
        DockerRunnerOptions options,
        int? timeoutSecondsOverride,
        CancellationToken cancellationToken)
    {
        if (!await IsDockerAvailableAsync(cancellationToken))
        {
            return new RunCodeResponse(
                false,
                -1,
                string.Empty,
                "Docker is not available on the runner service host.");
        }

        var tempDirectory = Path.Combine(Path.GetTempPath(), "rtwhiteboard-docker-runner", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDirectory);

        var sourcePath = Path.Combine(tempDirectory, fileName);
        var inputPath = Path.Combine(tempDirectory, "stdin.txt");

        await File.WriteAllTextAsync(sourcePath, code, Utf8WithoutBom, cancellationToken);
        await File.WriteAllTextAsync(inputPath, input ?? string.Empty, Utf8WithoutBom, cancellationToken);

        var timeout = TimeSpan.FromSeconds(timeoutSecondsOverride ?? options.TimeoutSeconds);
        var imageName = $"{options.ImagePrefix}/{languageKey}-runner:{options.ImageTag}";
        var volumeArgument = $"{tempDirectory.Replace("\\", "/")}:/workspace";
        var arguments =
            $"run --rm --network none --memory {options.MemoryMegabytes}m --cpus {options.CpuLimit.ToString(System.Globalization.CultureInfo.InvariantCulture)} --volume \"{volumeArgument}\" {imageName}";

        try
        {
            return await RunProcessAsync(
                "docker",
                arguments,
                tempDirectory,
                timeout,
                cancellationToken);
        }
        catch (Exception exception)
        {
            return new RunCodeResponse(
                false,
                -1,
                string.Empty,
                $"Unable to run {languageDisplayName} in Docker: {exception.Message}");
        }
        finally
        {
            if (Directory.Exists(tempDirectory))
            {
                Directory.Delete(tempDirectory, recursive: true);
            }
        }
    }

    private static async Task<bool> IsDockerAvailableAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "docker",
                    Arguments = "version --format \"{{.Server.Version}}\"",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                }
            };

            process.Start();
            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeoutCts.CancelAfter(TimeSpan.FromSeconds(3));
            await process.WaitForExitAsync(timeoutCts.Token);
            return process.ExitCode == 0;
        }
        catch
        {
            return false;
        }
    }

    private static async Task<RunCodeResponse> RunProcessAsync(
        string fileName,
        string arguments,
        string workingDirectory,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        using var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = fileName,
                Arguments = arguments,
                WorkingDirectory = workingDirectory,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
                StandardOutputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8
            }
        };

        process.Start();

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(timeout);

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

            return new RunCodeResponse(false, -1, string.Empty, $"Execution timed out after {timeout.TotalSeconds:0} seconds.");
        }

        var output = await outputTask;
        var error = await errorTask;

        if (process.ExitCode != 0 && error.Contains("Unable to find image", StringComparison.OrdinalIgnoreCase))
        {
            error =
                $"{error.Trim()}\nBuild the runner images first using docker compose for CodeRunner.Service.";
        }

        return new RunCodeResponse(process.ExitCode == 0, process.ExitCode, output, error);
    }
}
