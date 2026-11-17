import { z } from 'zod';

// COD Showdown results for the live scorecard at /live. The roster and schedule live in the page itself;
// the server only keeps what organisers enter, so shapes are bounded rather than checked against the roster.
const matchId = z.string().regex(/^[A-Z0-9-]{1,20}$/, 'Unknown match');
const player = z.string().trim().min(1).max(120);
const score = z.number().int().min(0).max(999);
const bounded = <T extends z.ZodTypeAny>(value:T, max:number) => z.record(player, value).refine(r => Object.keys(r).length <= max, `At most ${max} entries`);
const ffaResult = z.object({pl:bounded(z.number().int().min(0).max(16), 16).default({}), k:bounded(score, 16).default({})}).strict();
const t2Result = z.object({s:z.tuple([score.nullable(), score.nullable()])}).strict();
const forfeit = z.object({ff:z.union([z.literal(0), z.literal(1)])}).strict();
export const codResultSchema = z.union([forfeit, t2Result, ffaResult]);
const finalists = z.array(player).min(1).max(16);
const points = z.number().int().min(0).max(99);
export const codRulesSchema = z.object({place:z.array(points).length(4), kill:points, ffaAdv:z.number().int().min(2).max(16), win:points, draw:points, loss:points}).partial().strict();
export const codSchema = z.object({
  r:z.record(matchId, codResultSchema).refine(r => Object.keys(r).length <= 100, 'Too many matches').default({}),
  fin:z.object({ffa:finalists, t2:finalists}).partial().strict().default({}),
  rules:codRulesSchema.default({}),
});
export type CodState = z.infer<typeof codSchema>;

const change = z.discriminatedUnion('op', [
  z.object({op:z.literal('result'), id:matchId, value:codResultSchema.nullable()}),
  z.object({op:z.literal('finalists'), ev:z.enum(['ffa', 't2']), names:finalists.nullable()}),
  z.object({op:z.literal('rules'), rules:codRulesSchema}),
]);
export const codChangesSchema = z.object({changes:z.array(change).min(1).max(200)}).strict();
export type CodChange = z.infer<typeof change>;

// Each change touches one match, one final line-up or the rules, so organisers scoring different
// matches at the same time never overwrite each other.
export function applyCodChanges(cod:CodState, changes:CodChange[]){
  for (const c of changes){
    if (c.op === 'result'){ if (c.value) cod.r[c.id] = c.value; else delete cod.r[c.id]; }
    else if (c.op === 'finalists'){ if (c.names) cod.fin[c.ev] = c.names; else delete cod.fin[c.ev]; }
    else cod.rules = c.rules;
  }
}
