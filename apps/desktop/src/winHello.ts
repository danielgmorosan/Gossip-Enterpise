/**
 * Windows Hello bridge — drives the WinRT `UserConsentVerifier` (the real Hello
 * face/fingerprint/PIN prompt) via `powershell.exe`.
 *
 * Why PowerShell and not a native addon: Windows PowerShell 5.1 (present on every
 * Win10/11) can project WinRT types, so we get Hello with **no native Node module
 * to build/rebuild per Electron ABI, and no extra bundled .exe** — the latter
 * matters because an unsigned helper would itself be blocked by Smart App Control.
 * `powershell.exe` is Microsoft-signed, so SAC trusts it.
 *
 * The passphrase itself is sealed with Electron `safeStorage` (Windows DPAPI) in
 * main.ts — same bio-vault.bin as the macOS path; this module only performs the
 * verification gesture and reports whether Hello is available.
 *
 * Enum values we care about (both use 0 = the good outcome):
 *   UserConsentVerifierAvailability.Available          = 0
 *   UserConsentVerificationResult.Verified             = 0
 */
import { spawn } from "node:child_process";

// The WinRT await shim + type projection, shared by both scripts. PowerShell 5.1
// can't `await` a WinRT IAsyncOperation directly, so we bounce it through
// System.WindowsRuntimeSystemExtensions.AsTask and Wait().
const PRELUDE = `
$ErrorActionPreference = 'Stop'
$null = [Windows.Security.Credentials.UI.UserConsentVerifier,Windows.Security.Credentials.UI,ContentType=WindowsRuntime]
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
function Await($op, $resultType) {
  $m = $asTaskGeneric.MakeGenericMethod($resultType)
  $t = $m.Invoke($null, @($op))
  $t.Wait(-1) | Out-Null
  $t.Result
}
`;

/** Run a PowerShell snippet and return the integer it prints as "RESULT:<n>". */
function runPs(script: string, timeoutMs: number): Promise<number> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (n: number) => {
      if (!settled) {
        settled = true;
        resolve(n);
      }
    };
    let ps;
    try {
      ps = spawn(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", PRELUDE + script],
        { windowsHide: true },
      );
    } catch {
      return done(-1);
    }
    const timer = setTimeout(() => {
      try {
        ps.kill();
      } catch {
        /* already gone */
      }
      done(-1);
    }, timeoutMs);
    let out = "";
    ps.stdout.on("data", (d) => (out += d.toString()));
    ps.on("error", () => {
      clearTimeout(timer);
      done(-1);
    });
    ps.on("close", () => {
      clearTimeout(timer);
      const m = /RESULT:(-?\d+)/.exec(out);
      done(m ? Number(m[1]) : -1);
    });
  });
}

/** True when Windows Hello (or a device PIN) is enrolled and usable. */
export async function winHelloAvailable(): Promise<boolean> {
  if (process.platform !== "win32") return false;
  const code = await runPs(
    `$a = Await ([Windows.Security.Credentials.UI.UserConsentVerifier]::CheckAvailabilityAsync()) ([Windows.Security.Credentials.UI.UserConsentVerifierAvailability])
Write-Output "RESULT:$([int]$a)"`,
    10_000,
  );
  return code === 0; // Available
}

/** Show the Hello prompt; resolve true only on a verified gesture. */
export async function winHelloVerify(reason: string): Promise<boolean> {
  if (process.platform !== "win32") return false;
  // reason is a hard-coded constant from main.ts (not user input); keep it that
  // way — it's interpolated into the script.
  const safe = reason.replace(/[^\w .,'!?-]/g, "");
  const code = await runPs(
    `$r = Await ([Windows.Security.Credentials.UI.UserConsentVerifier]::RequestVerificationAsync("${safe}")) ([Windows.Security.Credentials.UI.UserConsentVerificationResult])
Write-Output "RESULT:$([int]$r)"`,
    60_000,
  );
  return code === 0; // Verified
}
