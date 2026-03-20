using Microsoft.AspNetCore.Mvc;
using Whiteboard.Api.Contracts;
using Whiteboard.Api.Services;

namespace Whiteboard.Api.Controllers;

[ApiController]
[Route("api/code")]
public sealed class CodeExecutionController(ICodeExecutionService codeExecutionService) : ControllerBase
{
    private readonly ICodeExecutionService _codeExecutionService = codeExecutionService;

    [HttpPost("run")]
    public async Task<ActionResult<RunCodeResponse>> RunCode(
        [FromBody] RunCodeRequest request,
        CancellationToken cancellationToken)
    {
        var response = await _codeExecutionService.ExecuteAsync(request, cancellationToken);
        return Ok(response);
    }
}
