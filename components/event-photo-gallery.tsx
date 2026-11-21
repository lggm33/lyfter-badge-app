import Image from "next/image";
import { deleteEventPhoto, uploadEventPhoto } from "@/app/(protected)/company/[companyId]/actions";
import { ActionForm } from "@/components/action-form";

export type EventPhoto = {
  id: string;
  url: string;
  alt: string | null;
};

export function EventPhotoGallery({
  companyId,
  eventId,
  eventName,
  photos,
  manage = false,
}: {
  companyId?: string;
  eventId: string;
  eventName: string;
  photos: EventPhoto[];
  manage?: boolean;
}) {
  return (
    <section className="grid w-full gap-3 border-t border-slate-100 pt-4">
      <h3 className="font-black text-slate-800">Fotos</h3>
      {photos.length === 0 ? (
        <p className="text-sm text-slate-500">Todavía no hay fotos.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {photos.map((photo) => (
            <li className="grid gap-2" key={photo.id}>
              <Image
                alt={photo.alt || `Foto de ${eventName}`}
                className="h-28 w-full rounded-xl object-cover"
                height={224}
                src={photo.url}
                width={320}
              />
              {photo.alt && <p className="text-sm text-slate-600">{photo.alt}</p>}
              {manage && companyId && (
                <form action={deleteEventPhoto}>
                  <input name="companyId" type="hidden" value={companyId} />
                  <input name="eventId" type="hidden" value={eventId} />
                  <input name="photoId" type="hidden" value={photo.id} />
                  <button className="text-sm font-bold text-red-600" type="submit">
                    Quitar
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      {manage && companyId && (
        <ActionForm action={uploadEventPhoto} className="grid gap-2">
          <input name="companyId" type="hidden" value={companyId} />
          <input name="eventId" type="hidden" value={eventId} />
          <label className="grid gap-1 text-sm font-bold text-slate-700">
            Agregar foto
            <input accept="image/jpeg,image/png,image/webp" className="font-normal" name="photo" required type="file" />
          </label>
          <input
            className="rounded-xl border border-slate-200 px-3 py-2"
            maxLength={140}
            name="alt"
            placeholder="Leyenda"
          />
          <button className="justify-self-start rounded-full bg-slate-800 px-4 py-2 font-bold text-white" type="submit">
            Subir
          </button>
        </ActionForm>
      )}
    </section>
  );
}
