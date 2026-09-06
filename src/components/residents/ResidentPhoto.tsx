/**
 * The profile photo card.
 *
 * Images never travel as base64 and never pass through our API: the browser
 * asks for a presigned PUT, uploads straight to the private bucket, then tells
 * the API the object landed. Showing an existing photo mints a short-lived
 * signed GET for that one view.
 */
import { useRef, useState, type ChangeEvent } from 'react';
import type { ResidentDto } from '@hostel/shared';
import { UPLOAD_LIMITS, formatMonthLabel } from '@hostel/shared';
import { Button } from '../common/Button';
import { Lightbox } from '../common/Lightbox';
import { errorMessage } from '../common/states';
import { useConfirm } from '../common/ConfirmProvider';
import { useToast } from '../common/ToastProvider';
import { usePermissions } from '../../auth/AuthProvider';
import { initialsOf } from '../../utils/format';
import {
  useDocumentUrl,
  useRemoveResidentDocument,
  useUploadResidentDocument,
  validateDocumentFile,
} from '../../hooks/useResidents';

const ACCEPT = UPLOAD_LIMITS.PHOTO_MIME_TYPES.join(',');

export interface ResidentPhotoProps {
  resident: ResidentDto;
}

export function ResidentPhoto({ resident }: ResidentPhotoProps): JSX.Element {
  const permissions = usePermissions();
  const confirm = useConfirm();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const photo = useDocumentUrl(resident.id, 'photo', resident.hasPhoto);
  const upload = useUploadResidentDocument();
  const remove = useRemoveResidentDocument();

  const src = resident.hasPhoto ? (photo.data?.url ?? null) : null;

  const onPick = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    // Let the same file be chosen twice in a row.
    event.target.value = '';
    if (!file) return;

    const problem = validateDocumentFile(file, 'photo');
    if (problem) {
      toast.error(problem);
      return;
    }

    try {
      await upload.mutateAsync({ residentId: resident.id, kind: 'photo', file });
      toast.success('Photo saved.');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const onRemove = async (): Promise<void> => {
    const ok = await confirm({
      title: 'Remove this photo?',
      message: `The photo of ${resident.name} will be deleted from storage.`,
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      await remove.mutateAsync({ residentId: resident.id, kind: 'photo' });
      setLightboxOpen(false);
      toast.success('Photo removed.');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const tenure = resident.vacatedMonth
    ? `vacated ${formatMonthLabel(resident.vacatedMonth)}`
    : `staying since ${formatMonthLabel(resident.joinMonth)}`;

  return (
    <div className="card">
      <div style={{ padding: '16px 16px 0' }}>
        <div className="photo">
          {src ? (
            <img
              src={src}
              alt={resident.name}
              onClick={() => setLightboxOpen(true)}
              role="button"
            />
          ) : (
            <div className="ph">{initialsOf(resident.name)}</div>
          )}
        </div>
        <h2 style={{ fontSize: 19, marginTop: 12 }}>{resident.name}</h2>
        <div className="sub">
          {resident.buildingName} · {tenure}
        </div>
        {photo.error ? (
          <div className="hint" style={{ color: 'var(--late)', marginTop: 6 }}>
            {errorMessage(photo.error)}
          </div>
        ) : null}
      </div>

      {permissions.canManageRecords ? (
        <div className="imgacts">
          <Button
            variant="ghost"
            size="sm"
            loading={upload.isPending}
            onClick={() => fileInput.current?.click()}
          >
            Add photo
          </Button>
          {resident.hasPhoto ? (
            <Button variant="danger" size="sm" loading={remove.isPending} onClick={() => void onRemove()}>
              Remove
            </Button>
          ) : null}
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            hidden
            onChange={(event) => void onPick(event)}
          />
        </div>
      ) : null}

      <Lightbox
        src={lightboxOpen ? src : null}
        alt={resident.name}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}
