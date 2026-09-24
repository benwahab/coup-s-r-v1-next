import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ProviderHorse = {
  externalId: string;
  number: number;
  name: string;
  intlName?: string | null;
  jockey?: string | null;
  trainer?: string | null;
  status: "partant" | "non-partant";
  form?: string | null;
  winRate?: number | null;
  placeRate?: number | null;
  weight?: number | null;
  odds?: number | null;
};

type ProviderRace = {
  externalId: string;
  raceDate: string;
  venue: string;
  raceNumber: number;
  name?: string | null;
  startAt: string;
  status: "scheduled" | "open" | "closed" | "finished" | "cancelled";
  horses: ProviderHorse[];
};

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

Deno.serve(async (req) => {
  const expected = Deno.env.get("PMU_SYNC_SECRET");
  if (!expected) {
    return Response.json({ error: "pmu_sync_not_configured" }, { status: 503 });
  }
  if (req.headers.get("x-pmu-sync-secret") !== expected) {
    return new Response("unauthorized", { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const providerUrl = Deno.env.get("PMU_PROVIDER_URL");
  const providerKey = Deno.env.get("PMU_PROVIDER_KEY");

  if (!supabaseUrl || !serviceRoleKey || !providerUrl || !providerKey) {
    return Response.json({ error: "pmu_provider_not_configured" }, { status: 503 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const response = await fetch(providerUrl, {
    headers: { authorization: `Bearer ${providerKey}`, accept: "application/json" },
  });
  if (!response.ok) return Response.json({ error: "pmu_provider_request_failed", status: response.status }, { status: 502 });

  const payload = await response.json() as { races?: ProviderRace[] };
  const races = Array.isArray(payload.races) ? payload.races : [];
  if (!races.length) return Response.json({ ok: true, races: 0, horses: 0 });

  let raceCount = 0;
  let horseCount = 0;

  for (const race of races) {
    if (!race.externalId || !validDate(race.raceDate) || !race.startAt || !Array.isArray(race.horses)) continue;

    const { data: raceRow, error: raceError } = await supabase
      .from("pmu_races")
      .upsert({
        external_id: race.externalId,
        race_date: race.raceDate,
        venue: race.venue,
        race_number: race.raceNumber,
        name: race.name ?? null,
        start_at: race.startAt,
        status: race.status,
        source: "licensed_provider",
        source_updated_at: new Date().toISOString(),
      }, { onConflict: "external_id" })
      .select("id")
      .single();

    if (raceError || !raceRow) continue;
    raceCount++;

    const rows = race.horses
      .filter((horse) => Number.isInteger(horse.number) && horse.number > 0 && horse.externalId && horse.name)
      .map((horse) => ({
        race_id: raceRow.id,
        external_id: horse.externalId,
        number: horse.number,
        name: horse.name,
        intl_name: horse.intlName ?? null,
        jockey: horse.jockey ?? null,
        trainer: horse.trainer ?? null,
        status: horse.status,
        form: horse.form ?? null,
        win_rate: horse.winRate ?? null,
        place_rate: horse.placeRate ?? null,
        weight: horse.weight ?? null,
        odds: horse.odds ?? null,
        source: "licensed_provider",
        source_updated_at: new Date().toISOString(),
      }));

    if (rows.length) {
      const { error } = await supabase.from("pmu_horses").upsert(rows, { onConflict: "race_id,external_id" });
      if (!error) horseCount += rows.length;
    }
  }

  return Response.json({ ok: true, races: raceCount, horses: horseCount });
});