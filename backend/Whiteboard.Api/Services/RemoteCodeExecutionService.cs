using System.Net.Http.Json;
using Microsoft.Extensions.Options;
using Whiteboard.Api.Contracts;

namespace Whiteboard.Api.Services;

public sealed class RemoteCodeExecutionService(
    HttpClient httpClient,
    IOptions<CodeRunnerOptions> options) : ICodeExecutionService
{
    private readonly HttpClient _httpClient = httpClient;
    private readonly CodeRunnerOptions _options = options.Value;

    public async Task<RunCodeResponse> ExecuteAsync(
        RunCodeRequest request,
        CancellationToken cancellationToken)
    {
        using var response = await _httpClient.PostAsJsonAsync(
            $"{_options.BaseUrl.TrimEnd('/')}/api/run",
            request,
            cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            return new RunCodeResponse(
                false,
                -1,
                string.Empty,
                $"Code runner returned HTTP {(int)response.StatusCode}.");
        }

        return await response.Content.ReadFromJsonAsync<RunCodeResponse>(cancellationToken)
            ?? new RunCodeResponse(false, -1, string.Empty, "Code runner returned no payload.");
    }
}
