import { useIntl } from "react-intl";
import { useAudioRecording } from "../utils/useAudioRecording";
import { useWorkFlowStore } from "../../stores/useWorkFlowStore";
import { validateWorkAttachments } from "../../modules/work/work-attachments";
import { toastService } from "../../components/Toast/toast.service";
import { track } from "../../modules/app/posthog";
export function useWorkAudioRecording() {
  const intl = useIntl();
  const audioNotes = useWorkFlowStore((state) => state.audioNotes);
  const recording = useAudioRecording({
    onRecordingComplete: (file) => {
      const current = useWorkFlowStore.getState().audioNotes;
      if (validateWorkAttachments(useWorkFlowStore.getState().images, [...current, file]).length) {
        toastService.error({
          title: intl.formatMessage({
            id: "app.garden.attachments.invalid",
            defaultMessage:
              "Check attachment formats and sizes. Photos: 10 MB; videos: 20 MB and 30 seconds; all files: 50 MB.",
          }),
        });
        return;
      }
      useWorkFlowStore.getState().setAudioNotes([...current, file]);
      track(
        "audio_note_recorded",
        { duration: "unknown", noteIndex: current.length },
        { includeSessionId: false }
      );
    },
  });
  return { ...recording, audioNotes };
}
