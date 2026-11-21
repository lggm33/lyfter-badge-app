export function EventPlaceFields({
  location,
  country,
  modality,
}: {
  location?: string | null;
  country?: string | null;
  modality?: string | null;
}) {
  return (
    <>
      <input
        className="rounded-xl border border-slate-200 px-4 py-3"
        name="location"
        placeholder="Ubicación"
        defaultValue={location ?? ""}
      />
      <input
        className="rounded-xl border border-slate-200 px-4 py-3"
        name="country"
        placeholder="País"
        maxLength={80}
        defaultValue={country ?? ""}
      />
      <label className="grid gap-1 text-sm font-bold text-slate-700">
        Modalidad
        <select
          className="rounded-xl border border-slate-200 px-4 py-3 font-normal"
          name="modality"
          required
          defaultValue={modality ?? ""}
        >
          <option value="">Elegí una modalidad</option>
          <option value="IN_PERSON">Presencial</option>
          <option value="VIRTUAL">Virtual</option>
          <option value="HYBRID">Híbrido</option>
        </select>
      </label>
    </>
  );
}
