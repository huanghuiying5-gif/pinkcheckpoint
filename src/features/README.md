# Feature boundaries

Each folder owns one product capability and will expose its public API through
an `index.ts` file when that capability is implemented.

- `reading-session`: coordinates countdown, recording, reflection, and results.
- `recording`: owns microphone permission and MediaRecorder behavior.
- `ai-reflection`: owns the simulated analysis transition.
- `feedback`: owns simulated rhythm, fluency, and clarity feedback.
- `teacher-setup`: owns passage editing and saving through the shared service.

Feature code must not access a persistence mechanism directly. Reading passage
data is loaded and saved through `ReadingPassageService`.
