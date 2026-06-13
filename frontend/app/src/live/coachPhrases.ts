/**
 * Coaching phrase library. Every phrase is tagged with:
 *  - trigger:   id of the condition (evaluated in coach.ts TRIGGERS)
 *  - stepTypes: which recipe stepTypes it's relevant to ("any" = all)
 *  - severity:  "safety" bypasses the global throttle; "tip"/"praise" don't
 *  - cooldownSec: per-phrase repeat suppression
 *  - what / how / why: correction structure (what's wrong, how to fix, why it matters)
 */
import type { StepType } from "../data/recipes";

export type Severity = "safety" | "tip" | "praise";

export type TriggerId =
  | "extended-fingers-knife"
  | "extended-fingers-any"
  | "partial-grip-knife"
  | "unsteady-while-cutting"
  | "guard-grip-good"
  | "steady-clean-streak"
  | "step-entered"
  | "hands-returned";

export type CoachPhrase = {
  id: string;
  trigger: TriggerId;
  stepTypes: (StepType | "any")[];
  severity: Severity;
  cooldownSec: number;
  what: string;
  how: string;
  why: string;
};

export function phraseText(p: CoachPhrase): string {
  return `${p.what} ${p.how} ${p.why}`;
}

export const COACH_PHRASES: CoachPhrase[] = [
  // ——— SAFETY: extended fingers near a blade (chop) ———
  { id: "knife-claw-1", trigger: "extended-fingers-knife", stepTypes: ["chop"], severity: "safety", cooldownSec: 15, what: "Careful — your fingertips are pointing out.", how: "Curl them under so your knuckles face the blade, like a claw.", why: "Knuckles can guide the knife; fingertips can't get out of its way." },
  { id: "knife-claw-2", trigger: "extended-fingers-knife", stepTypes: ["chop"], severity: "safety", cooldownSec: 15, what: "Watch the guiding hand.", how: "Tuck your fingertips back and rest the flat of the blade against your knuckles.", why: "The claw grip means a slip cuts air, not skin." },
  { id: "knife-claw-3", trigger: "extended-fingers-knife", stepTypes: ["chop"], severity: "safety", cooldownSec: 15, what: "Fingers are creeping forward.", how: "Reset: curl all four fingertips under before the next cut.", why: "Most kitchen cuts happen mid-batch when the grip relaxes." },
  { id: "knife-partial-1", trigger: "partial-grip-knife", stepTypes: ["chop"], severity: "safety", cooldownSec: 20, what: "Your grip is half-open.", how: "Commit to the claw — all fingertips tucked, thumb behind them.", why: "A half grip gives the blade a target without giving you control." },
  { id: "knife-unsteady-1", trigger: "unsteady-while-cutting", stepTypes: ["chop"], severity: "safety", cooldownSec: 20, what: "The board's getting shaky.", how: "Slow your cuts and plant the food flat-side down first.", why: "A stable base is the difference between slicing food and chasing it." },
  { id: "knife-unsteady-2", trigger: "unsteady-while-cutting", stepTypes: ["chop"], severity: "safety", cooldownSec: 20, what: "Lots of movement in frame.", how: "Pause, square up to the board, and find a comfortable stance.", why: "Rushing cuts is how knives win arguments." },
  { id: "fingers-hot-pan-1", trigger: "extended-fingers-any", stepTypes: ["heat"], severity: "safety", cooldownSec: 25, what: "Fingers are hovering open near the heat.", how: "Use the handle or a utensil rather than reaching over the pan.", why: "Steam burns rise faster than you can pull back." },

  // ——— TECHNIQUE: chop ———
  { id: "chop-rock-1", trigger: "step-entered", stepTypes: ["chop"], severity: "tip", cooldownSec: 90, what: "Knife work coming up.", how: "Keep the tip on the board and rock the blade through the food.", why: "Rocking uses the knife's weight, so your arm does less and wobbles less." },
  { id: "chop-even-1", trigger: "step-entered", stepTypes: ["chop"], severity: "tip", cooldownSec: 90, what: "Aim for even pieces.", how: "Match each cut to the size of your first one.", why: "Even pieces finish cooking at the same moment — no raw-and-burnt mix." },
  { id: "chop-slow-1", trigger: "unsteady-while-cutting", stepTypes: ["chop"], severity: "tip", cooldownSec: 60, what: "No race here.", how: "Halve your speed and let each cut land cleanly.", why: "Speed comes from repetition, not from hurrying today." },
  { id: "chop-board-1", trigger: "step-entered", stepTypes: ["chop"], severity: "tip", cooldownSec: 120, what: "Check your board.", how: "A damp towel underneath stops it sliding.", why: "A moving board doubles the difficulty of every cut." },

  // ——— TECHNIQUE: stir ———
  { id: "stir-bottom-1", trigger: "step-entered", stepTypes: ["stir"], severity: "tip", cooldownSec: 90, what: "Time to stir.", how: "Scrape the bottom and corners, not just the middle.", why: "Food sticks and burns at the edges first — the middle takes care of itself." },
  { id: "stir-gentle-1", trigger: "step-entered", stepTypes: ["stir"], severity: "tip", cooldownSec: 90, what: "Easy does it.", how: "Fold rather than whip unless the recipe says otherwise.", why: "Aggressive stirring breaks food apart and cools the pan." },
  { id: "stir-steady-1", trigger: "steady-clean-streak", stepTypes: ["stir"], severity: "praise", cooldownSec: 120, what: "That's a lovely stirring rhythm.", how: "Keep that pace.", why: "Consistent motion means consistent cooking." },

  // ——— TECHNIQUE: heat ———
  { id: "heat-listen-1", trigger: "step-entered", stepTypes: ["heat"], severity: "tip", cooldownSec: 90, what: "Use your ears here.", how: "A gentle sizzle is right; silence means too cold, crackling-spitting means too hot.", why: "Sound tells you pan temperature faster than looking does." },
  { id: "heat-patience-1", trigger: "step-entered", stepTypes: ["heat"], severity: "tip", cooldownSec: 120, what: "Resist the urge to poke.", how: "Let the food sit and make contact with the pan.", why: "Browning needs uninterrupted contact — moving it resets the clock." },
  { id: "heat-smell-1", trigger: "step-entered", stepTypes: ["heat"], severity: "tip", cooldownSec: 120, what: "Stay close and trust your nose.", how: "Sweet and toasty is on track; sharp or acrid means pull the pan now.", why: "Smell is your earliest burn alarm — earlier than smoke." },

  // ——— TECHNIQUE: transfer ———
  { id: "transfer-prep-1", trigger: "step-entered", stepTypes: ["transfer"], severity: "tip", cooldownSec: 90, what: "Before you lift anything —", how: "Clear the path and have the destination ready and close.", why: "Most spills happen mid-air over the gap you didn't plan." },
  { id: "transfer-grip-1", trigger: "step-entered", stepTypes: ["transfer"], severity: "tip", cooldownSec: 90, what: "Two points of contact.", how: "Handle in one hand, support the base or lid with the other.", why: "One-handed transfers are how dinner meets the floor." },

  // ——— TECHNIQUE: plate ———
  { id: "plate-warm-1", trigger: "step-entered", stepTypes: ["plate"], severity: "tip", cooldownSec: 120, what: "Plating time.", how: "Warm plates if you can — 30 seconds of hot tap water works.", why: "Cold plates steal heat from the food before the first bite." },
  { id: "plate-taste-1", trigger: "step-entered", stepTypes: ["plate"], severity: "tip", cooldownSec: 120, what: "Last chance to adjust.", how: "Taste once more and add a small pinch of salt or squeeze of acid if it's flat.", why: "Seasoning fades as food cools — finish strong." },

  // ——— TECHNIQUE: prep ———
  { id: "prep-mise-1", trigger: "step-entered", stepTypes: ["prep"], severity: "tip", cooldownSec: 120, what: "Set yourself up.", how: "Get every ingredient measured and within arm's reach before continuing.", why: "Mise en place turns cooking from a scramble into a sequence." },
  { id: "prep-towel-1", trigger: "step-entered", stepTypes: ["prep"], severity: "tip", cooldownSec: 180, what: "Pro habit:", how: "Keep a towel within reach for hands and handles.", why: "Dry hands grip; wet hands slip — on knives and hot pans alike." },

  // ——— TECHNIQUE: rest ———
  { id: "rest-wait-1", trigger: "step-entered", stepTypes: ["rest"], severity: "tip", cooldownSec: 120, what: "Hands off for this one.", how: "Set the timer and step back — no peeking, no pressing.", why: "Resting redistributes juices; cutting early pours them onto the board." },
  { id: "rest-clean-1", trigger: "step-entered", stepTypes: ["rest"], severity: "tip", cooldownSec: 180, what: "Free minute unlocked.", how: "Rinse a pan or wipe the board while you wait.", why: "Cleaning during rests is why some cooks finish with an empty sink." },

  // ——— PRAISE / REINFORCEMENT ———
  { id: "praise-guard-1", trigger: "guard-grip-good", stepTypes: ["chop"], severity: "praise", cooldownSec: 90, what: "That claw grip is spot on.", how: "Keep those knuckles forward.", why: "You're protecting your fingertips exactly right." },
  { id: "praise-guard-2", trigger: "guard-grip-good", stepTypes: ["chop"], severity: "praise", cooldownSec: 90, what: "Textbook guiding hand.", how: "Same grip, every cut.", why: "Consistency is what makes safe technique automatic." },
  { id: "praise-steady-1", trigger: "steady-clean-streak", stepTypes: ["any"], severity: "praise", cooldownSec: 120, what: "Beautifully steady hands.", how: "Whatever you're doing, keep doing it.", why: "Calm hands make even cuts and even cooking." },
  { id: "praise-steady-2", trigger: "steady-clean-streak", stepTypes: ["any"], severity: "praise", cooldownSec: 120, what: "You've found a rhythm.", how: "Carry that pace into the next step.", why: "Smooth is fast in the kitchen." },
  { id: "praise-steady-3", trigger: "steady-clean-streak", stepTypes: ["any"], severity: "praise", cooldownSec: 150, what: "Looking confident in there.", how: "Trust the process.", why: "Confidence is a skill too, and you're practicing it." },

  // ——— GENERAL / RE-ENGAGEMENT ———
  { id: "hands-back-1", trigger: "hands-returned", stepTypes: ["any"], severity: "tip", cooldownSec: 60, what: "Good, I can see your hands again.", how: "Carry on — I'll keep watching.", why: "I can only coach what's in frame." },
  { id: "step-generic-1", trigger: "step-entered", stepTypes: ["any"], severity: "tip", cooldownSec: 180, what: "New step.", how: "Read it through once before your hands move.", why: "Ten seconds of reading saves a mid-step scramble." },

  // ——— EXTRA SAFETY VARIANTS (rotation so repeats don't sound robotic) ———
  { id: "knife-claw-4", trigger: "extended-fingers-knife", stepTypes: ["chop"], severity: "safety", cooldownSec: 15, what: "Tips out again.", how: "Knuckles forward, tips tucked — every cut.", why: "The grip only protects you while you hold it." },
  { id: "knife-claw-5", trigger: "extended-fingers-knife", stepTypes: ["chop"], severity: "safety", cooldownSec: 15, what: "Let's fix that guiding hand.", how: "Make a loose fist, then relax it onto the food.", why: "Starting from a fist makes the claw automatic." },
  { id: "fingers-hot-pan-2", trigger: "extended-fingers-any", stepTypes: ["heat"], severity: "safety", cooldownSec: 25, what: "Mind the reach.", how: "Come at the pan from the side, not from above.", why: "The column of heat above a pan burns before the metal does." },

  // ——— EXTRA TIPS (coverage breadth) ———
  { id: "chop-claw-intro-1", trigger: "step-entered", stepTypes: ["chop"], severity: "tip", cooldownSec: 120, what: "Quick grip check before cutting.", how: "Guiding hand: fingertips curled, knuckles against the blade's flat.", why: "Set the grip before the first cut and it lasts the whole batch." },
  { id: "heat-dry-1", trigger: "step-entered", stepTypes: ["heat"], severity: "tip", cooldownSec: 150, what: "Pat food dry before it hits the fat.", how: "A quick press with paper towel is enough.", why: "Water is the enemy of browning — and the cause of oil spatter." },
  { id: "stir-deglaze-1", trigger: "step-entered", stepTypes: ["stir"], severity: "tip", cooldownSec: 150, what: "See brown bits on the pan?", how: "A splash of liquid and a scrape lifts them into the sauce.", why: "That fond is concentrated flavor, not mess." },
  { id: "plate-height-1", trigger: "step-entered", stepTypes: ["plate"], severity: "tip", cooldownSec: 180, what: "Stack, don't spread.", how: "Pile food slightly toward the center of the plate.", why: "Height keeps food hot longer and looks intentional." },
  { id: "prep-trash-1", trigger: "step-entered", stepTypes: ["prep"], severity: "tip", cooldownSec: 180, what: "Make a scrap pile.", how: "One bowl or corner of the board for all trimmings.", why: "A clear board is a safe board." },
  { id: "transfer-tilt-1", trigger: "step-entered", stepTypes: ["transfer"], severity: "tip", cooldownSec: 120, what: "Pour away from yourself.", how: "Tilt the far edge down and let it flow.", why: "Splashes follow the pour line — keep yourself off it." },
  { id: "rest-carry-1", trigger: "step-entered", stepTypes: ["rest"], severity: "tip", cooldownSec: 180, what: "Remember carryover heat.", how: "Food keeps cooking a few degrees after the heat stops.", why: "Resting isn't waiting — it's the last stage of cooking." },
  { id: "praise-return-1", trigger: "guard-grip-good", stepTypes: ["chop"], severity: "praise", cooldownSec: 120, what: "Grip corrected — nicely done.", how: "That's the habit to build.", why: "Self-correcting is the real skill; I just remind." },
];
