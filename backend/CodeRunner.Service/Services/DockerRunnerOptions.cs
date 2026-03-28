namespace CodeRunner.Service.Services;

public sealed class DockerRunnerOptions
{
    public string ImagePrefix { get; set; } = "rtwhiteboard";
    public string ImageTag { get; set; } = "latest";
    public int TimeoutSeconds { get; set; } = 8;
    public int MemoryMegabytes { get; set; } = 256;
    public decimal CpuLimit { get; set; } = 1.0m;
}
