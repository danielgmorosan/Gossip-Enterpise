// Umbry process-loopback audio capturer (Windows 10 2004+ / 11).
//
// Captures system audio while EXCLUDING (or INCLUDING) a target process tree,
// using the WASAPI Process Loopback API — the same mechanism Discord/Teams use
// for clean screenshare audio. Excluding Umbry's own process tree removes the
// call playback from the capture, so there's no echo/feedback. Including a
// single app's PID captures only that app (for window share).
//
// Output: raw interleaved 48 kHz stereo 32-bit float PCM on stdout (binary).
// Usage:  loopback.exe --pid <N> --mode exclude|include
//
// Adapted from Microsoft's official ApplicationLoopback SDK sample. Build with
// build.bat (see README.md). Diagnostics go to stderr.

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <mmdeviceapi.h>
#include <audioclient.h>
#include <audioclientactivationparams.h>
#include <mmreg.h>
#include <wrl/implements.h>
#include <io.h>
#include <fcntl.h>
#include <cstdio>
#include <vector>

#pragma comment(lib, "ole32.lib")

using namespace Microsoft::WRL;

// Completion handler so we can wait for the async interface activation.
class ActivateHandler
    : public RuntimeClass<RuntimeClassFlags<ClassicCom>, FtmBase, IActivateAudioInterfaceCompletionHandler> {
 public:
  HANDLE done = CreateEventW(nullptr, FALSE, FALSE, nullptr);
  HRESULT hr = E_FAIL;
  ComPtr<IAudioClient> client;

  STDMETHOD(ActivateCompleted)(IActivateAudioInterfaceAsyncOperation* op) override {
    ComPtr<IUnknown> unknown;
    HRESULT activateHr = S_OK;
    op->GetActivateResult(&activateHr, &unknown);
    hr = activateHr;
    if (SUCCEEDED(activateHr) && unknown) unknown.As(&client);
    SetEvent(done);
    return S_OK;
  }
};

static void fail(const wchar_t* what, HRESULT hr) {
  fwprintf(stderr, L"[loopback] %s failed: 0x%08x\n", what, hr);
}

int wmain(int argc, wchar_t** argv) {
  DWORD pid = 0;
  bool include = false;
  for (int i = 1; i + 1 < argc; i++) {
    if (!wcscmp(argv[i], L"--pid")) pid = (DWORD)_wtoi(argv[i + 1]);
    else if (!wcscmp(argv[i], L"--mode")) include = !wcscmp(argv[i + 1], L"include");
  }
  if (pid == 0) {
    fwprintf(stderr, L"[loopback] usage: loopback.exe --pid <N> --mode exclude|include\n");
    return 2;
  }

  HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
  if (FAILED(hr)) { fail(L"CoInitializeEx", hr); return 1; }

  // Activate an IAudioClient bound to the process-loopback virtual device.
  AUDIOCLIENT_ACTIVATION_PARAMS params = {};
  params.ActivationType = AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK;
  params.ProcessLoopbackParams.TargetProcessId = pid;
  params.ProcessLoopbackParams.ProcessLoopbackMode =
      include ? PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE
              : PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE;

  PROPVARIANT pv = {};
  pv.vt = VT_BLOB;
  pv.blob.cbSize = sizeof(params);
  pv.blob.pBlobData = reinterpret_cast<BYTE*>(&params);

  auto handler = Make<ActivateHandler>();
  ComPtr<IActivateAudioInterfaceAsyncOperation> op;
  hr = ActivateAudioInterfaceAsync(VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK, __uuidof(IAudioClient), &pv,
                                   handler.Get(), &op);
  if (FAILED(hr)) { fail(L"ActivateAudioInterfaceAsync", hr); return 1; }
  WaitForSingleObject(handler->done, INFINITE);
  if (FAILED(handler->hr) || !handler->client) { fail(L"activate", handler->hr); return 1; }
  ComPtr<IAudioClient> client = handler->client;

  // Fixed capture format: 48 kHz, stereo, 32-bit float (what Web Audio wants).
  WAVEFORMATEX fmt = {};
  fmt.wFormatTag = WAVE_FORMAT_IEEE_FLOAT;
  fmt.nChannels = 2;
  fmt.nSamplesPerSec = 48000;
  fmt.wBitsPerSample = 32;
  fmt.nBlockAlign = (fmt.nChannels * fmt.wBitsPerSample) / 8;
  fmt.nAvgBytesPerSec = fmt.nSamplesPerSec * fmt.nBlockAlign;
  fmt.cbSize = 0;

  // Event-driven shared-mode loopback capture; 200 ms buffer (hns units).
  hr = client->Initialize(AUDCLNT_SHAREMODE_SHARED,
                          AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
                          2000000, 0, &fmt, nullptr);
  if (FAILED(hr)) { fail(L"IAudioClient::Initialize", hr); return 1; }

  HANDLE sampleReady = CreateEventW(nullptr, FALSE, FALSE, nullptr);
  client->SetEventHandle(sampleReady);

  ComPtr<IAudioCaptureClient> capture;
  hr = client->GetService(__uuidof(IAudioCaptureClient), reinterpret_cast<void**>(capture.GetAddressOf()));
  if (FAILED(hr)) { fail(L"GetService(IAudioCaptureClient)", hr); return 1; }

  hr = client->Start();
  if (FAILED(hr)) { fail(L"IAudioClient::Start", hr); return 1; }

  _setmode(_fileno(stdout), _O_BINARY);
  fwprintf(stderr, L"[loopback] capturing (pid=%lu mode=%s)\n", pid, include ? L"include" : L"exclude");

  std::vector<char> silence;
  for (;;) {
    if (WaitForSingleObject(sampleReady, 2000) != WAIT_OBJECT_0) continue; // keep alive on timeout
    UINT32 packet = 0;
    if (FAILED(capture->GetNextPacketSize(&packet))) break;
    while (packet != 0) {
      BYTE* data = nullptr;
      UINT32 frames = 0;
      DWORD flags = 0;
      if (FAILED(capture->GetBuffer(&data, &frames, &flags, nullptr, nullptr))) break;
      const size_t bytes = (size_t)frames * fmt.nBlockAlign;
      if (flags & AUDCLNT_BUFFERFLAGS_SILENT) {
        if (silence.size() < bytes) silence.resize(bytes, 0);
        fwrite(silence.data(), 1, bytes, stdout);
      } else if (data && bytes) {
        fwrite(data, 1, bytes, stdout);
      }
      fflush(stdout);
      capture->ReleaseBuffer(frames);
      if (FAILED(capture->GetNextPacketSize(&packet))) { packet = 0; break; }
    }
    // Parent gone / stdout closed → exit.
    if (ferror(stdout)) break;
  }

  client->Stop();
  CoUninitialize();
  return 0;
}
