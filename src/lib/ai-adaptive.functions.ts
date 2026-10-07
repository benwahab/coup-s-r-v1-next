import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL_VERSION = "adaptive-v1";

const PmuPrediction = z.object({
  summary: z.string(),
  tierce: z.array(z.number().int().positive()).length(3),
  quinte: z.array(z.number().int().positive()).length(5),
  confidence: z.enum(["faible","moyenne","élevée"]),
  rationale: z.string(),
});

function normalize(p: number[]) {
  const s = p.reduce((a,b)=>a+b,0);
  return s > 0 ? p.map(x=>x/s) : p.map(()=>1/p.length);
}

async function storePrediction(gameId:string, referenceId:string, predictionDate:string, features:unknown, prediction:unknown) {
  const { data, error } = await (supabaseAdmin as any).from("ai_predictions").upsert({
    game_id:gameId, reference_id:referenceId, prediction_date:predictionDate,
    model_version:MODEL_VERSION, features, prediction, status:"published"
  }, { onConflict:"game_id,reference_id,model_version" }).select("id").single();
  if (error) throw new Error("ai_prediction_store_failed");
  return data;
}

export const generateAdaptivePmu = createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
  .inputValidator((data:unknown)=>z.object({raceId:z.string().uuid()}).parse(data))
  .handler(async ({data})=>{
    const {data:race,error:re}=await supabaseAdmin.from("pmu_races").select("id,race_date,name,start_at,status").eq("id",data.raceId).maybeSingle();
    if(re||!race) throw new Error("pmu_race_not_found");
    const {data:horses,error:he}=await supabaseAdmin.from("pmu_horses").select("number,name,jockey,trainer,form,win_rate,place_rate,weight,odds,status").eq("race_id",race.id).eq("status","partant").order("number");
    if(he||!horses?.length) throw new Error("pmu_starters_unavailable");
    const {data:history}=await supabaseAdmin.from("draw_results").select("draw_date,result").eq("game_id","pmu").eq("status","published").lt("draw_date",race.race_date).order("draw_date",{ascending:false}).limit(50);
    const recent=(history??[]).map((x:any)=>Array.isArray(x.result?.horses)?x.result.horses:[]).filter((x:number[])=>x.length);
    const counts=new Map<number,number>();
    for(const r of recent) r.slice(0,5).forEach((n:number,i:number)=>counts.set(n,(counts.get(n)||0)+(5-i)));
    const ranked=[...horses].sort((a:any,b:any)=>{
      const sa=(counts.get(Number(a.number))||0)+(Number(a.place_rate||0)*20)+(Number(a.win_rate||0)*30)+(a.odds?1/Number(a.odds):0)*10;
      const sb=(counts.get(Number(b.number))||0)+(Number(b.place_rate||0)*20)+(Number(b.win_rate||0)*30)+(b.odds?1/Number(b.odds):0)*10;
      return sb-sa;
    });
    const tierce=ranked.slice(0,3).map((h:any)=>Number(h.number));
    const quinte=ranked.slice(0,5).map((h:any)=>Number(h.number));
    const features={historyDraws:recent.length,starterCount:horses.length,ranking:ranked.slice(0,8).map((h:any)=>({number:h.number,historyScore:counts.get(Number(h.number))||0,winRate:h.win_rate,placeRate:h.place_rate,odds:h.odds}))};
    const key=process.env.LOVABLE_API_KEY;
    let narrative={summary:"Pronostic statistique calculé à partir des partants et de l'historique disponible.",confidence:"faible" as const,rationale:"Données historiques limitées."};
    if(key){
      try{
        const gateway=createLovableAiGatewayProvider(key);
        const {experimental_output}=await generateText({
          model:gateway("google/gemini-3-5-flash"),
          experimental_output:Output.object({schema:z.object({
            summary:z.string(),tierce:z.array(z.number().int().positive()).length(3),
            quinte:z.array(z.number().int().positive()).length(5),
            confidence:z.enum(["faible","moyenne","élevée"]),rationale:z.string()
          })}),
          system:"Tu es un analyste PMU prudent. Utilise uniquement les données fournies, ne prétends jamais connaître le futur et signale les limites.",
          prompt:JSON.stringify({race,topHorses:ranked.slice(0,8),history:recent.slice(0,20),statisticalTierce:tierce,statisticalQuinte:quinte})
        });
        narrative=experimental_output as any;
      }catch{}
    }
    const prediction={...narrative,tierce,quinte};
    await storePrediction("pmu",race.id,race.race_date,features,prediction);
    return {prediction,modelVersion:MODEL_VERSION};
  });

export const generateAdaptiveLoto = createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
  .inputValidator((data:unknown)=>z.object({drawDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).parse(data))
  .handler(async ({data})=>{
    const {data:rows,error}=await supabaseAdmin.from("draw_results").select("draw_date,result").eq("game_id","loto").eq("status","published").lte("draw_date",data.drawDate).order("draw_date",{ascending:false}).limit(100);
    if(error||!rows?.length) throw new Error("loto_history_unavailable");
    const history=(rows as any[]).map(r=>Array.isArray(r.result?.numbers)?r.result.numbers:[]).filter(x=>x.length);
    const counts=new Map<number,number>(); for(const draw of history) for(const n of draw) counts.set(n,(counts.get(n)||0)+1);
    const nums=Array.from({length:90},(_,i)=>i+1);
    const hot=[...nums].sort((a,b)=>(counts.get(b)||0)-(counts.get(a)||0)).slice(0,10);
    const cold=[...nums].sort((a,b)=>(counts.get(a)||0)-(counts.get(b)||0)).slice(0,10);
    const suggestions=[0,1,2].map(k=>hot.slice(k,k+3).concat(cold.slice(k,k+2)).sort((a,b)=>a-b));
    const prediction={summary:"Analyse descriptive de fréquence; les tirages restent aléatoires et aucune combinaison n'est garantie.",hot,cold,suggestions:suggestions.map(balls=>({balls,rationale:"Combinaison diversifiée issue des fréquences historiques, sans valeur prédictive garantie."})),confidence:"faible" as const};
    await storePrediction("loto",data.drawDate,data.drawDate,{historyDraws:history.length,frequency:Object.fromEntries(counts)},prediction);
    return {prediction,modelVersion:MODEL_VERSION};
  });

export const generateAdaptiveFoot = createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
  .inputValidator((data:unknown)=>z.object({fixtureId:z.string().uuid()}).parse(data))
  .handler(async ({data})=>{
    const {data:f,error:fe}=await supabaseAdmin.from("foot_fixtures").select("id,league_name,kickoff_at,home_team,away_team,odds_home,odds_draw,odds_away,status,home_score,away_score").eq("id",data.fixtureId).maybeSingle();
    if(fe||!f) throw new Error("foot_fixture_not_found");
    const {data:past}=await supabaseAdmin.from("foot_fixtures").select("home_team,away_team,home_score,away_score,league_name,kickoff_at").eq("status","finished").lt("kickoff_at",f.kickoff_at).order("kickoff_at",{ascending:false}).limit(500);
    const rows=(past??[]).filter((x:any)=>x.home_score!=null&&x.away_score!=null);
    const relevant=rows.filter((x:any)=>x.league_name===f.league_name);
    function teamStats(team:string){
      const games=rows.filter((x:any)=>x.home_team===team||x.away_team===team).slice(0,10);
      let w=0,d=0,l=0,gf=0,ga=0;
      for(const x of games){const home=x.home_team===team;const a=(home?x.home_score:x.away_score)??0;const b=(home?x.away_score:x.home_score)??0;gf+=a;ga+=b;if(a>b)w++;else if(a===b)d++;else l++;}
      return {games:games.length,w,d,l,gf,ga};
    }
    const hs=teamStats(f.home_team), as=teamStats(f.away_team);
    const base=[Math.max(1,hs.w+1),Math.max(1,(hs.d+as.d)/2+1),Math.max(1,as.w+1)];
    const odds=[Number(f.odds_home||0),Number(f.odds_draw||0),Number(f.odds_away||0)];
    const implied=odds.every(x=>x>0)?normalize(odds.map(x=>1/x)):[1/3,1/3,1/3];
    const stat=normalize([base[0],base[1],base[2]]);
    const probabilities=normalize([0.6*stat[0]+0.4*implied[0],0.6*stat[1]+0.4*implied[1],0.6*stat[2]+0.4*implied[2]]);
    const outcome=["1","X","2"][probabilities.indexOf(Math.max(...probabilities))] as "1"|"X"|"2";
    const features={league:f.league_name,leagueFinishedSamples:relevant.length,home:hs,away:as,odds:{home:f.odds_home,draw:f.odds_draw,away:f.odds_away},probabilities};
    const prediction={summary:"Tendance calculée à partir de la forme récente disponible, de la compétition et des cotes actuelles; elle ne garantit pas le résultat.",outcome,probabilities:{home:probabilities[0],draw:probabilities[1],away:probabilities[2]},confidence:probabilities.some(p=>p>0.55)?"moyenne":"faible",keyFactors:[
      "Forme récente: "+f.home_team+" "+hs.w+"-"+hs.d+"-"+hs.l,
      "Forme récente: "+f.away_team+" "+as.w+"-"+as.d+"-"+as.l,
      "Échantillon compétition: "+relevant.length+" matchs terminés"
    ]};
    await storePrediction("foot",f.id,new Date(f.kickoff_at).toISOString().slice(0,10),features,prediction);
    return {prediction,modelVersion:MODEL_VERSION};
  });

export async function evaluatePublishedAiPredictions(gameId:string, referenceId:string, actual:unknown){
  const {data:rows,error}=await (supabaseAdmin as any).from("ai_predictions").select("id,prediction,model_version").eq("game_id",gameId).eq("reference_id",referenceId).eq("status","published");
  if(error) return;
  for(const row of rows??[]){
    const p=row.prediction as any; let correct:boolean|null=null; let score:number|null=null;
    if(gameId==="foot" && p?.outcome && typeof actual==="string"){correct=p.outcome===actual;score=correct?1:0;}
    if(gameId==="loto" && Array.isArray((actual as any)?.numbers) && Array.isArray(p?.suggestions)){const actuals=new Set((actual as any).numbers); const hits=p.suggestions.map((s:any)=>Array.isArray(s.balls)?s.balls.filter((n:number)=>actuals.has(n)).length:0);score=hits.reduce((a:number,b:number)=>a+b,0)/(hits.length*5);correct=score>=0.6;}
    if(gameId==="pmu" && Array.isArray((actual as any)?.horses)){const top=new Set((p?.quinte??[])); const hit=(actual as any).horses.filter((n:number)=>top.has(n)).length;score=hit/Math.max(1,top.size);correct=hit>=3;}
    if(correct===null) continue;
    await (supabaseAdmin as any).from("ai_predictions").update({status:"evaluated",actual_result:actual,correct,score,evaluated_at:new Date().toISOString()}).eq("id",row.id);
  }
}
