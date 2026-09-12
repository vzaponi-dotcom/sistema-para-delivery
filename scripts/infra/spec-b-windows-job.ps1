param([Parameter(Mandatory=$true)][string]$RequestBase64)
$ErrorActionPreference = 'Stop'
$request = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($RequestBase64)) | ConvertFrom-Json

# The suspended launch closes the race where a short-lived launcher creates an
# orphan before it can be assigned to the job. Breakaway is not enabled.
Add-Type -TypeDefinition @'
using System;
using System.Collections.Concurrent;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
public static class SpecBJob {
  [StructLayout(LayoutKind.Sequential)] struct Limits {
    public long ProcessTime, JobTime; public uint Flags;
    public UIntPtr MinWorkingSet, MaxWorkingSet; public uint ProcessLimit;
    public UIntPtr Affinity; public uint Priority, Scheduling;
  }
  [StructLayout(LayoutKind.Sequential)] struct ExtendedLimits {
    public Limits Basic; public ulong ReadOps, WriteOps, OtherOps, ReadBytes, WriteBytes, OtherBytes;
    public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory;
  }
  [StructLayout(LayoutKind.Sequential)] struct Startup {
    public uint Size; public IntPtr Reserved, Desktop, Title;
    public uint X, Y, XSize, YSize, XChars, YChars, Fill, Flags;
    public ushort Show, ReservedSize; public IntPtr ReservedBytes, Input, Output, Error;
  }
  [StructLayout(LayoutKind.Sequential)] struct ProcessInfo { public IntPtr Process, Thread; public uint Pid, Tid; }
  [StructLayout(LayoutKind.Sequential)] struct Security { public int Size; public IntPtr Descriptor; public int Inherit; }
  [StructLayout(LayoutKind.Sequential)] struct Accounting {
    public long User, Kernel, PeriodUser, PeriodKernel;
    public uint Faults, Total, Active, Terminated;
  }
  [DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Unicode)] static extern IntPtr CreateJobObject(IntPtr attrs, string name);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int kind, ref ExtendedLimits data, uint size);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job, int kind, out Accounting data, uint size, IntPtr length);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateJobObject(IntPtr job, uint code);
  [DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Unicode)] static extern bool CreateProcess(string app, StringBuilder command, IntPtr processAttrs, IntPtr threadAttrs, bool inherit, uint flags, IntPtr env, string cwd, ref Startup startup, out ProcessInfo process);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool CreatePipe(out IntPtr read, out IntPtr write, ref Security attrs, uint size);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetHandleInformation(IntPtr handle, uint mask, uint flags);
  [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int kind);
  [DllImport("kernel32.dll", SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr process, out uint code);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateProcess(IntPtr process, uint code);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  static void Check(bool ok) { if (!ok) throw new Win32Exception(Marshal.GetLastWin32Error()); }
  static string Quote(string arg) {
    var result = new StringBuilder("\""); int slashes = 0;
    foreach (char c in arg) {
      if (c == '\\') { slashes++; continue; }
      result.Append('\\', c == '"' ? slashes * 2 + 1 : slashes); result.Append(c); slashes = 0;
    }
    result.Append('\\', slashes * 2); return result.Append('"').ToString();
  }
  public static int Run(string command, string[] args, string marker) {
    IntPtr job = IntPtr.Zero, inputRead = IntPtr.Zero, inputWrite = IntPtr.Zero;
    ProcessInfo child = new ProcessInfo(); bool drained = false;
    try {
      job = CreateJobObject(IntPtr.Zero, null); Check(job != IntPtr.Zero);
      var limits = new ExtendedLimits(); limits.Basic.Flags = 0x2000; // KILL_ON_JOB_CLOSE
      Check(SetInformationJobObject(job, 9, ref limits, (uint)Marshal.SizeOf(limits)));
      var security = new Security { Size = Marshal.SizeOf(typeof(Security)), Inherit = 1 };
      Check(CreatePipe(out inputRead, out inputWrite, ref security, 0));
      Check(SetHandleInformation(inputWrite, 1, 0));
      var startup = new Startup { Size = (uint)Marshal.SizeOf(typeof(Startup)), Flags = 0x100,
        Input = inputRead, Output = GetStdHandle(-11), Error = GetStdHandle(-12) };
      Check(SetHandleInformation(startup.Output, 1, 1)); Check(SetHandleInformation(startup.Error, 1, 1));
      var commandLine = new StringBuilder(Quote(command));
      foreach (string arg in args) commandLine.Append(" ").Append(Quote(arg));
      Check(CreateProcess(command, commandLine, IntPtr.Zero, IntPtr.Zero, true, 0x08000004, IntPtr.Zero, null, ref startup, out child));
      Check(AssignProcessToJobObject(job, child.Process));
      Check(ResumeThread(child.Thread) != 0xffffffff);
      CloseHandle(child.Thread); child.Thread = IntPtr.Zero; CloseHandle(inputRead); inputRead = IntPtr.Zero;
      var commands = new ConcurrentQueue<string>();
      var reader = new Thread(() => {
        try { string line; while ((line = Console.ReadLine()) != null) commands.Enqueue(line); }
        finally { commands.Enqueue("force"); } // The owning runner disappeared.
      }); reader.IsBackground = true; reader.Start();
      uint code = 259; bool exitReported = false;
      Console.Error.WriteLine(marker + "{\"type\":\"ready\",\"pid\":" + child.Pid + "}");
      while (true) {
        string action;
        while (commands.TryDequeue(out action)) {
          if (action == "stop" && inputWrite != IntPtr.Zero) { CloseHandle(inputWrite); inputWrite = IntPtr.Zero; }
          if (action == "force") Check(TerminateJobObject(job, 1));
        }
        Check(GetExitCodeProcess(child.Process, out code));
        if (code != 259 && !exitReported) {
          Console.Error.WriteLine(marker + "{\"type\":\"exit\",\"code\":" + code + "}"); exitReported = true;
        }
        Accounting state; Check(QueryInformationJobObject(job, 1, out state, (uint)Marshal.SizeOf(typeof(Accounting)), IntPtr.Zero));
        if (state.Active == 0) {
          drained = true; Console.Error.WriteLine(marker + "{\"type\":\"drained\"}"); return 0;
        }
        Thread.Sleep(15);
      }
    } finally {
      if (!drained && child.Process != IntPtr.Zero) TerminateProcess(child.Process, 1);
      if (job != IntPtr.Zero) CloseHandle(job); // Kernel terminates all descendants on errors too.
      if (child.Process != IntPtr.Zero) CloseHandle(child.Process);
      if (child.Thread != IntPtr.Zero) CloseHandle(child.Thread);
      if (inputRead != IntPtr.Zero) CloseHandle(inputRead);
      if (inputWrite != IntPtr.Zero) CloseHandle(inputWrite);
    }
  }
}
'@
exit [SpecBJob]::Run($request.command, [string[]]$request.args, $request.marker)
