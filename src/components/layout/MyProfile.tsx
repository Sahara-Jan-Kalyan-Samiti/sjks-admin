import { useState } from "react";
import { adminPhotoUrl, removeAdminPhoto, setAdminPhoto, updateAdmin } from "@/api/people";
import { useAuth, useMe } from "@/auth/AuthProvider";
import { Field } from "@/components/forms/controls";
import { useToast } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/primitives";
import { useBusy } from "@/hooks/useBusy";
import { messageOf } from "@/lib/errors";
import { imageProblem } from "@/lib/storage";

const MAX_MB = 5;
const MAX_NAME = 80;

/** "My profile": the signed-in admin changes their own name and photo. Opens from the name in the top bar. */
export function MyProfile({ onClose }: { onClose: () => void }) {
  const me = useMe();
  const { refresh } = useAuth();
  const toast = useToast();
  const [busy, run] = useBusy();
  const [name, setName] = useState(me.display_name ?? "");
  const [photo, setPhoto] = useState(me.photo_path);
  const [error, setError] = useState("");

  const initial = (me.email || "A")[0].toUpperCase();
  const clean = name.trim();
  const changed = clean !== (me.display_name ?? "").trim();

  async function saveName(ev: React.FormEvent) {
    ev.preventDefault();
    if (clean.length > MAX_NAME) return setError(`Use ${MAX_NAME} characters or fewer`);
    setError("");
    try {
      await run(async () => {
        await updateAdmin(me.id, { display_name: clean || null });
        await refresh();
      });
      toast("Name saved.");
    } catch (e) {
      toast(messageOf(e), "err");
    }
  }

  const photoAction = async (fn: () => Promise<string | null>, ok: string) => {
    try {
      await run(async () => {
        setPhoto(await fn());
        await refresh();
      });
      toast(ok);
    } catch (e) {
      toast(messageOf(e), "err");
    }
  };

  return (
    <Modal title="My profile" onClose={onClose}>
      <div className="profile-photo">
        {photo ? (
          <img className="profile-img" src={adminPhotoUrl(photo)} alt="Your photo" />
        ) : (
          <span className="profile-img" aria-hidden="true">
            {initial}
          </span>
        )}
        <div>
          <label className="btn-like">
            {photo ? "Change photo" : "Upload photo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                const problem = imageProblem(file, MAX_MB);
                if (problem) return toast(problem, "err");
                photoAction(async () => (await setAdminPhoto({ ...me, photo_path: photo }, file)).photo_path, "Photo saved.");
              }}
            />
          </label>
          {photo && (
            <button
              type="button"
              className="danger sm"
              disabled={busy}
              onClick={() => photoAction(async () => (await removeAdminPhoto({ ...me, photo_path: photo })).photo_path, "Photo removed.")}
            >
              Remove
            </button>
          )}
          <p className="mut">{`JPG, PNG or WebP, up to ${MAX_MB} MB.`}</p>
        </div>
      </div>

      <form noValidate onSubmit={saveName}>
        <Field label="Name" error={error}>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_NAME} placeholder="Your name" autoComplete="name" />
        </Field>
        <Field label="Email">
          <input value={me.email} disabled readOnly />
        </Field>
        <div className="row end">
          <button type="button" className="ghost" onClick={onClose}>
            Close
          </button>
          <Button type="submit" busy={busy} busyText="Saving…" disabled={!changed}>
            Save name
          </Button>
        </div>
      </form>
    </Modal>
  );
}
