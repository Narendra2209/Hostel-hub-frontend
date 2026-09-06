/**
 * The Aadhaar card on the resident profile.
 *
 * An identity document is the most sensitive thing this application stores, so
 * it lives in a private bucket, is uploaded straight from the browser with a
 * presigned PUT, and is only ever shown through a signed URL that expires in
 * minutes.
 */
import { useRef, useState, type ChangeEvent } from 'react';
import type { ResidentDto } from '@hostel/shared';
import { UPLOAD_LIMITS } from '@hostel/shared';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { Lightbox } from '../common/Lightbox';
import { errorMessage } from '../common/states';
import { useConfirm } from '../common/ConfirmProvider';
import { useToast } from '../common/ToastProvider';
import { usePermissions } from '../../auth/AuthProvider';
import {
  useDocumentUrl,
  useRemoveResidentDocument,
  useUploadResidentDocument,
  validateDocumentFile,
} from '../../hooks/useResidents';

const ACCEPT = UPLOAD_LIMITS.DOCUMENT_MIME_TYPES.join(',');

export interface ResidentDocumentsProps {
  resident: ResidentDto;
}

export function ResidentDocuments({ resident }: ResidentDocumentsProps): JSX.Element {
  const permissions = usePermissions();
  const confirm = useConfirm();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const card = useDocumentUrl(resident.id, 'aadhaar', resident.hasAadhaarDocument);
  const upload = useUploadResidentDocument();
  const remove = useRemoveResidentDocument();

  const stored = resident.hasAadhaarDocument ? (card.data ?? null) : null;
  const isImage = stored?.contentType?.startsWith('image/') ?? false;

  const onPick = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const problem = validateDocumentFile(file, 'aadhaar');
    if (problem) {
      toast.error(problem);
      return;
    }

    try {
      await upload.mutateAsync({ residentId: resident.id, kind: 'aadhaar', file });
      toast.success('Aadhaar card saved.');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const onRemove = async (): Promise<void> => {
    const ok = await confirm({
      title: 'Remove this card?',
      message: `The Aadhaar card stored for ${resident.name} will be deleted from storage.`,
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      await remove.mutateAsync({ residentId: resident.id, kind: 'aadhaar' });
      setLightboxOpen(false);
      toast.success('Aadhaar card removed.');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <Card title="Aadhaar card">
      <div style={{ padding: '16px 16px 0' }}>
        <div className="idcard">
          {stored && isImage ? (
            <img
              src={stored.url}
              alt={`Aadhaar card for ${resident.name}`}
              onClick={() => setLightboxOpen(true)}
              role="button"
            />
          ) : stored ? (
            <div className="ph">
              PDF document
              <br />
              <a href={stored.url} target="_blank" rel="noreferrer" className="link">
                Open the card
              </a>
            </div>
          ) : (
            <div className="ph">
              No card on file
              <br />
              Photograph or upload it here
            </div>
          )}
        </div>
        {card.error ? (
          <div className="hint" style={{ color: 'var(--late)', marginTop: 6 }}>
            {errorMessage(card.error)}
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
            Add card
          </Button>
          {resident.hasAadhaarDocument ? (
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

      <div className="hint" style={{ padding: '0 16px 14px' }}>
        Stored securely; only signed-in staff can open it.
      </div>

      <Lightbox
        src={lightboxOpen && isImage ? (stored?.url ?? null) : null}
        alt={`Aadhaar card for ${resident.name}`}
        onClose={() => setLightboxOpen(false)}
      />
    </Card>
  );
}
