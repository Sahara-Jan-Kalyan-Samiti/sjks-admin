import { supabase } from "@/lib/supabase";
import { unwrap, unwrapList } from "@/lib/errors";
import { backend } from "@/lib/backend";
import { removeFiles, signedUrl, uploadFile } from "@/lib/storage";
import type { DocumentRequest, RequestAttachment } from "@/types";
import { crud, listAll } from "./crud";

const requests = crud<DocumentRequest>("document_requests");

export const getDocumentRequests = () => listAll<DocumentRequest>("document_requests", [{ column: "created_at", ascending: false }]);
export async function getDocumentRequest(id: number): Promise<DocumentRequest> {
  return unwrap(await supabase.from("document_requests").select("*").eq("id", id).single()) as DocumentRequest;
}
export const updateDocumentRequest = (id: number, data: Record<string, unknown>) => requests.update(id, data);

export async function deleteDocumentRequest(id: number): Promise<void> {
  const { data: atts } = await supabase.from("request_attachments").select("storage_path").eq("request_id", id);
  await removeFiles(
    "request-files",
    (atts ?? []).map((a) => a.storage_path)
  );
  await requests.remove(id);
}

export async function getRequestAttachments(requestId: number): Promise<RequestAttachment[]> {
  return unwrapList(
    await supabase.from("request_attachments").select("*").eq("request_id", requestId).order("uploaded_at")
  ) as RequestAttachment[];
}
export async function uploadRequestAttachment(requestId: number, file: File): Promise<RequestAttachment> {
  const path = `${requestId}/${Date.now()}-${file.name}`;
  await uploadFile("request-files", path, file);
  return unwrap(
    await supabase
      .from("request_attachments")
      .insert([{ request_id: requestId, filename: file.name, storage_path: path, mime: file.type, size_bytes: file.size }])
      .select()
      .single()
  ) as RequestAttachment;
}
export async function deleteRequestAttachment(att: RequestAttachment): Promise<void> {
  await removeFiles("request-files", [att.storage_path]);
  unwrap(await supabase.from("request_attachments").delete().eq("id", att.id));
}
export const getRequestFileUrl = (storagePath: string) => signedUrl("request-files", storagePath);

/** The pre-filled message and whether the backend can send e-mail (needs the backend). */
export const getDefaultMessage = (id: number) => backend<{ message: string; mailReady: boolean }>(`/api/requests/${id}/default-message`);
/** E-mails the attached documents to the requester and marks the request as sent (needs the backend and SMTP). */
export const sendRequestDocuments = (id: number, subject: string, message: string) =>
  backend(`/api/requests/${id}/send`, { method: "POST", body: { subject, message } });
