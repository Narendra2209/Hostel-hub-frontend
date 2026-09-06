import { useEffect } from 'react';
/**
 * Everything the residents list and the resident profile read and write.
 *
 * The screens themselves never call the API directly: they use these hooks so
 * that the cache keys, the invalidation fan-out after a mutation and the rules
 * around short-lived document URLs are decided in exactly one place.
 *
 * No financial value is derived here. `expected`, `paid`, `balance`, `status`,
 * `totalOverdue` and the month strip all arrive from the API already worked out.
 */
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import type {
  CreateResidentInput,
  DocumentKind,
  MonthKey,
  MoveResidentInput,
  UpdateResidentInput,
  VacateResidentInput,
} from '@hostel/shared';
import { UPLOAD_LIMITS } from '@hostel/shared';
import { documentsApi, residentsApi, type ResidentListParams } from '../api/resources';
import { queryKeys } from '../api/queryKeys';
import { useInvalidate } from './useInvalidate';

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

/**
 * One page of the roster, already priced for the selected month by the server.
 * The previous page stays on screen while the next one loads, so paging never
 * flashes an empty table.
 */
export function useResidentList(params: ResidentListParams) {
  return useQuery({
    queryKey: queryKeys.residents.list(params),
    queryFn: () => residentsApi.list(params),
    placeholderData: keepPreviousData,
  });
}

/** One resident record - used by the edit form, which may be deep-linked. */
export function useResident(id: string | null) {
  const residentId = id ?? '';
  return useQuery({
    queryKey: queryKeys.residents.detail(residentId),
    queryFn: () => residentsApi.get(residentId),
    enabled: residentId.length > 0,
  });
}

/** The whole profile screen in a single request. */
export function useResidentProfile(id: string, month: MonthKey) {
  return useQuery({
    queryKey: queryKeys.residents.profile(id, month),
    queryFn: () => residentsApi.profile(id, month),
    enabled: id.length > 0,
  });
}

/** The Jan-Dec fee strip for one resident and one calendar year. */
export function useResidentFeeStrip(id: string, year: number) {
  return useQuery({
    queryKey: queryKeys.residents.feeStatus(id, year),
    queryFn: () => residentsApi.feeStatus(id, year),
    enabled: id.length > 0,
  });
}

/* ------------------------------------------------------------------ *
 * Writes
 * ------------------------------------------------------------------ */

export function useCreateResident() {
  const { financial, resident } = useInvalidate();
  return useMutation({
    mutationFn: (input: CreateResidentInput) => residentsApi.create(input),
    onSuccess: (created) => {
      financial();
      resident(created.id);
    },
  });
}

export function useUpdateResident() {
  const { financial, resident } = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateResidentInput }) =>
      residentsApi.update(id, input),
    onSuccess: (updated) => {
      financial();
      resident(updated.id);
    },
  });
}

/**
 * Remove a resident. The server archives anyone with payments on record rather
 * than deleting them, and reports which it did through `archived`.
 */
export function useArchiveResident() {
  const { financial, resident } = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => residentsApi.remove(id),
    onSuccess: (result) => {
      financial();
      resident(result.id);
    },
  });
}

export function useMoveResident() {
  const { financial, resident } = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: MoveResidentInput }) =>
      residentsApi.move(id, input),
    onSuccess: (_result, variables) => {
      financial();
      resident(variables.id);
    },
  });
}

export function useVacateResident() {
  const { financial, resident } = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: VacateResidentInput }) =>
      residentsApi.vacate(id, input),
    onSuccess: (_result, variables) => {
      financial();
      resident(variables.id);
    },
  });
}

/* ------------------------------------------------------------------ *
 * Documents (private S3, presigned in both directions)
 * ------------------------------------------------------------------ */

const MB = 1024 * 1024;

/** Garbage-collect a signed URL well before the server's own expiry. */
/**
 * An object URL for a stored document.
 *
 * The bytes come from an authenticated API route, because an <img> tag cannot
 * send a session token and the cookie is not available cross-origin. The blob
 * URL is revoked as soon as the query leaves the cache, so a document does not
 * sit in memory after the profile is closed.
 */
export function useDocumentUrl(residentId: string, kind: DocumentKind, hasDocument: boolean) {
  const query = useQuery({
    queryKey: queryKeys.documents.forResident(residentId, kind),
    queryFn: () => documentsApi.objectUrl(residentId, kind),
    enabled: hasDocument && residentId.length > 0,
    // The bytes do not change unless the document is replaced, and any such
    // change invalidates this key explicitly.
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  // Release the blob when this component stops using it. Without this, opening
  // a dozen profiles would pin a dozen images in memory for the session.
  const url = query.data?.url;
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  return query;
}

/**
 * Upload a document. One multipart POST to our own API, which validates the
 * type and size and stores the bytes in GridFS.
 */
export function useUploadResidentDocument() {
  const { resident, raw } = useInvalidate();
  return useMutation({
    mutationFn: ({
      residentId,
      kind,
      file,
      onProgress,
    }: {
      residentId: string;
      kind: DocumentKind;
      file: File;
      onProgress?: (percent: number) => void;
    }) => documentsApi.upload(residentId, kind, file, onProgress),
    onSuccess: (_updated, variables) => {
      resident(variables.residentId);
      // Drop the cached blob URL so the replaced image is re-fetched.
      raw.removeQueries({
        queryKey: queryKeys.documents.forResident(variables.residentId, variables.kind),
      });
    },
  });
}

export function useRemoveResidentDocument() {
  const { resident, raw } = useInvalidate();
  return useMutation({
    mutationFn: ({ residentId, kind }: { residentId: string; kind: DocumentKind }) =>
      documentsApi.remove(residentId, kind),
    onSuccess: (_result, variables) => {
      resident(variables.residentId);
      raw.removeQueries({
        queryKey: queryKeys.documents.forResident(variables.residentId, variables.kind),
      });
    },
  });
}

/**
 * Client-side checks before a byte leaves the browser. The API applies exactly
 * the same limits again when it decides whether to sign the upload.
 */
export function validateDocumentFile(file: File, kind: DocumentKind): string | null {
  const allowed: readonly string[] =
    kind === 'photo' ? UPLOAD_LIMITS.PHOTO_MIME_TYPES : UPLOAD_LIMITS.DOCUMENT_MIME_TYPES;
  const maxBytes =
    kind === 'photo' ? UPLOAD_LIMITS.MAX_IMAGE_BYTES : UPLOAD_LIMITS.MAX_DOCUMENT_BYTES;

  if (file.size === 0) return 'That file appears to be empty.';
  if (!allowed.includes(file.type)) return `Allowed file types: ${allowed.join(', ')}`;
  if (file.size > maxBytes) return `File must be ${Math.round(maxBytes / MB)} MB or smaller`;
  return null;
}
