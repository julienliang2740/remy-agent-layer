/**
 * Local recipe dataset — the offline fallback "cookbook" (the primary recipe
 * path is the backend POST /recipe). Ingredient `name`s reuse the pantry
 * vocabulary in App.tsx so coverage matching in matching.ts lines up.
 *
 * Teaching layer:
 *  - every step has a `stepType` (binds live CV coaching to what the cook is doing)
 *  - `why` explains the reason behind the instruction (tap-to-expand in UI)
 *  - heat steps carry a `doneness` cue: what done LOOKS/SOUNDS/SMELLS like
 *  - `difficulty` (1 beginner / 2 intermediate / 3 comfortable) feeds skill-fit ranking
 */
export const STEP_TYPES = [
  "chop",
  "stir",
  "heat",
  "transfer",
  "plate",
  "prep",
  "rest",
] as const;
export type StepType = (typeof STEP_TYPES)[number];

export type RecipeIngredient = { name: string; amount: string };
export type RecipeStep = {
  title: string;
  body: string;
  stepType: StepType;
  /** The reason behind the instruction — the teaching layer. */
  why?: string;
  /** For heat steps: what "done" looks/sounds/smells like. */
  doneness?: string;
};

export type Recipe = {
  id: string;
  title: string;
  emoji: string;
  time: string;
  level: string;
  /** 1 = beginner-friendly, 2 = some technique, 3 = needs comfort in the kitchen. */
  difficulty: 1 | 2 | 3;
  skill: string;
  blurb: string;
  ingredients: RecipeIngredient[];
  tools: string[];
  steps: RecipeStep[];
  remyNote: string;
};

/**
 * Infer a sensible timer length (minutes) for a step. Explicit numbers in the
 * text win ("simmer 15 minutes" → 15); otherwise common slow techniques get a
 * practical default. Returns null for hands-on steps that don't need a timer.
 */
const KEYWORD_MINUTES: ReadonlyArray<readonly [RegExp, number]> = [
  [/\bboil/i, 9],
  [/\bsimmer/i, 10],
  [/\bbake/i, 12],
  [/\bbraise/i, 25],
  [/\brest\b/i, 5],
  [/\btoast/i, 2],
  [/\bpoach/i, 6],
  [/\bsteam/i, 12],
];

/** Infer a stepType from free text (used for backend-generated recipes). */
export function inferStepType(text: string): StepType {
  const t = text.toLowerCase();
  if (/(chop|slice|dice|mince|cut\b)/.test(t)) return "chop";
  if (/(stir|toss|fold|mix|whisk|swirl)/.test(t)) return "stir";
  if (/(boil|simmer|fry|sear|saut|bake|roast|heat|cook|brown|melt)/.test(t)) return "heat";
  if (/(transfer|pour|drain|move to)/.test(t)) return "transfer";
  if (/(serve|plate|garnish|finish)/.test(t)) return "plate";
  if (/(rest|wait|sit for|cool)/.test(t)) return "rest";
  return "prep";
}

export function stepMinutes(step: RecipeStep): number | null {
  const text = `${step.title} ${step.body}`;
  const explicit = text.match(/(\d+)\s*min/i);
  if (explicit) return Math.min(60, Math.max(1, parseInt(explicit[1]!, 10)));
  for (const [re, mins] of KEYWORD_MINUTES) {
    if (re.test(text)) return mins;
  }
  return null;
}

export const RECIPES: Recipe[] = [
  {
    id: "garlic-butter-pasta",
    title: "Garlic butter pasta",
    emoji: "🍝",
    time: "20 min",
    level: "Easy+",
    difficulty: 2,
    skill: "Sauté",
    blurb: "A buttery, garlicky weeknight bowl — we'll focus on getting the garlic golden, not burnt.",
    ingredients: [
      { name: "Pasta", amount: "200 g" },
      { name: "Butter", amount: "2 tbsp" },
      { name: "Garlic", amount: "3 cloves" },
      { name: "Olive oil", amount: "1 tbsp" },
      { name: "Parmesan", amount: "30 g" },
      { name: "Chili flakes", amount: "1 pinch" },
    ],
    tools: ["Pot", "Skillet", "Wood spoon"],
    steps: [
      {
        title: "Boil the pasta",
        body: "Salt the water well and cook the pasta until just shy of al dente. Reserve a cup of pasta water.",
        stepType: "heat",
        why: "Undercooking slightly lets the pasta finish in the sauce, soaking up flavor instead of plain water.",
        doneness: "Water at a rolling boil; pasta bends but still has a firm bite at the center.",
      },
      {
        title: "Soften the garlic",
        body: "Warm butter + olive oil over medium-low. Add sliced garlic and coax it to pale gold — pull the heat the moment it smells nutty.",
        stepType: "heat",
        why: "Garlic burns fast and turns bitter; low heat extracts sweetness instead.",
        doneness: "Pale gold edges, gentle fizz around the slices, a nutty (not sharp) smell.",
      },
      {
        title: "Add pasta water",
        body: "Splash in reserved pasta water and swirl to a thin, glossy emulsion.",
        stepType: "stir",
        why: "The starch in pasta water binds fat and water into a sauce that clings instead of pooling.",
      },
      {
        title: "Toss the pasta",
        body: "Add the drained pasta and toss hard so every strand is coated.",
        stepType: "stir",
        why: "Agitation releases surface starch — that's what makes the sauce silky.",
      },
      {
        title: "Finish",
        body: "Off heat, fold in parmesan and a pinch of chili flakes. Taste and adjust salt.",
        stepType: "plate",
        why: "Cheese added off-heat melts smoothly; on direct heat it clumps and goes grainy.",
      },
    ],
    remyNote: "We'll watch the garlic together. Pull it the moment it smells nutty.",
  },
  {
    id: "classic-omelette",
    title: "Fluffy omelette",
    emoji: "🍳",
    time: "8 min",
    level: "Easy",
    difficulty: 1,
    skill: "Eggs",
    blurb: "A soft, just-set omelette — low heat and patience do all the work.",
    ingredients: [
      { name: "Eggs", amount: "3" },
      { name: "Butter", amount: "1 tbsp" },
      { name: "Parmesan", amount: "2 tbsp" },
      { name: "Spinach", amount: "1 handful" },
    ],
    tools: ["Skillet", "Wood spoon"],
    steps: [
      {
        title: "Beat the eggs",
        body: "Whisk eggs with a pinch of salt until fully blended.",
        stepType: "prep",
        why: "Salting now dissolves into the egg and seasons evenly; whisking adds the air that makes it fluffy.",
      },
      {
        title: "Melt butter",
        body: "Melt butter over medium-low until foaming but not browning.",
        stepType: "heat",
        why: "Foam means the water has cooked off and the pan is ready — browning means it's already too hot.",
        doneness: "Butter foams gently and smells sweet; no brown specks.",
      },
      {
        title: "Cook gently",
        body: "Pour in eggs, stir slowly, then let set. Scatter spinach and parmesan.",
        stepType: "heat",
        why: "Slow stirring makes small soft curds; high heat makes rubber.",
        doneness: "Edges set, top still glossy and slightly wet.",
      },
      {
        title: "Fold & serve",
        body: "Fold while the top is still a touch glossy — it keeps cooking on the plate.",
        stepType: "plate",
        why: "Carryover heat finishes the center; waiting for fully-dry eggs means overcooked by the table.",
      },
    ],
    remyNote: "Keep the heat low — a browned omelette means the pan was too hot.",
  },
  {
    id: "egg-fried-rice",
    title: "Egg fried rice",
    emoji: "🍚",
    time: "15 min",
    level: "Easy+",
    difficulty: 2,
    skill: "Wok toss",
    blurb: "Day-old rice is your friend here — drier grains fry up fluffy, not mushy.",
    ingredients: [
      { name: "Rice", amount: "2 cups cooked" },
      { name: "Eggs", amount: "2" },
      { name: "Onion", amount: "1/2, diced" },
      { name: "Garlic", amount: "2 cloves" },
      { name: "Soy sauce", amount: "2 tbsp" },
      { name: "Green onion", amount: "2 stalks" },
    ],
    tools: ["Skillet", "Wood spoon"],
    steps: [
      {
        title: "Scramble eggs",
        body: "Cook the eggs first, break into curds, set aside.",
        stepType: "heat",
        why: "Cooking eggs separately keeps them in distinct pieces instead of coating the rice in raw egg.",
        doneness: "Just-set curds, still shiny — they cook again later.",
      },
      {
        title: "Aromatics",
        body: "Fry onion and garlic until fragrant and translucent.",
        stepType: "heat",
        why: "Building flavor in the oil first means every grain picks it up.",
        doneness: "Onion translucent at the edges, garlic fragrant but not colored.",
      },
      {
        title: "Fry the rice",
        body: "Add cold rice and press it into the hot pan so it sears before you toss.",
        stepType: "heat",
        why: "Pressing maximizes contact — that sear is where the smoky 'fried' flavor comes from.",
        doneness: "Grains sizzle loudly and start to jump; edges turn light gold.",
      },
      {
        title: "Season",
        body: "Splash soy sauce around the edge, fold eggs back in, finish with green onion.",
        stepType: "stir",
        why: "Soy hitting the hot pan edge caramelizes instantly — deeper flavor than pouring it on the rice.",
      },
    ],
    remyNote: "Let the rice sit and sear between tosses — that's where the flavor is.",
  },
  {
    id: "tomato-spinach-soup",
    title: "Tomato & spinach soup",
    emoji: "🍅",
    time: "30 min",
    level: "Easy",
    difficulty: 1,
    skill: "Simmer",
    blurb: "A cozy, blended tomato soup brightened with a handful of spinach.",
    ingredients: [
      { name: "Tomato", amount: "5, chopped" },
      { name: "Onion", amount: "1" },
      { name: "Garlic", amount: "2 cloves" },
      { name: "Olive oil", amount: "2 tbsp" },
      { name: "Spinach", amount: "2 handfuls" },
      { name: "Vegetable broth", amount: "2 cups" },
    ],
    tools: ["Pot", "Wood spoon"],
    steps: [
      {
        title: "Sweat aromatics",
        body: "Soften onion and garlic in olive oil over medium.",
        stepType: "heat",
        why: "Sweating (not browning) keeps the base sweet and lets the tomato flavor lead.",
        doneness: "Onion translucent and soft, no color, smells sweet.",
      },
      {
        title: "Add tomatoes",
        body: "Add chopped tomatoes and a pinch of salt; cook until collapsed.",
        stepType: "heat",
        why: "Salt pulls the juice out of the tomatoes so they break down into sauce faster.",
        doneness: "Tomatoes slumped and saucy, skins loose, juices bubbling.",
      },
      {
        title: "Simmer",
        body: "Pour in broth and simmer 15 minutes.",
        stepType: "heat",
        why: "A gentle simmer melds flavors; a hard boil makes it taste flat and waterlogged.",
        doneness: "Small lazy bubbles, not a rolling boil; smells rounded, not raw.",
      },
      {
        title: "Wilt & blend",
        body: "Stir in spinach, then blend smooth. Adjust salt.",
        stepType: "stir",
        why: "Spinach added last keeps its color and fresh taste instead of going army-green.",
      },
    ],
    remyNote: "Blend in batches and leave the lid cracked so steam can escape safely.",
  },
  {
    id: "aglio-e-olio",
    title: "Spaghetti aglio e olio",
    emoji: "🍝",
    time: "18 min",
    level: "Easy+",
    difficulty: 2,
    skill: "Emulsify",
    blurb: "Four ingredients, all about technique: silky garlic-oil sauce clinging to the pasta.",
    ingredients: [
      { name: "Pasta", amount: "200 g" },
      { name: "Garlic", amount: "4 cloves" },
      { name: "Olive oil", amount: "4 tbsp" },
      { name: "Chili flakes", amount: "1/2 tsp" },
      { name: "Parsley", amount: "2 tbsp" },
    ],
    tools: ["Pot", "Skillet"],
    steps: [
      {
        title: "Cook pasta",
        body: "Boil pasta in well-salted water; reserve pasta water.",
        stepType: "heat",
        why: "With four ingredients, the pasta water IS the sauce base — don't pour it away.",
        doneness: "Rolling boil; pasta one minute shy of the packet time.",
      },
      {
        title: "Infuse the oil",
        body: "Gently warm thinly sliced garlic in olive oil with chili flakes until pale gold.",
        stepType: "heat",
        why: "Low heat pulls garlic flavor into the oil; browning it makes the whole dish bitter.",
        doneness: "Slices pale gold and barely fizzing; aroma sweet, not acrid.",
      },
      {
        title: "Emulsify",
        body: "Add a ladle of pasta water and swirl into a glossy sauce.",
        stepType: "stir",
        why: "Starch + oil + agitation = emulsion. That's the difference between sauce and greasy pasta.",
      },
      {
        title: "Toss",
        body: "Add pasta and parsley; toss vigorously off heat.",
        stepType: "stir",
        why: "Tossing off heat keeps the emulsion from breaking back into oil.",
      },
    ],
    remyNote: "Low and slow on the garlic — brown garlic turns bitter fast.",
  },
  {
    id: "shakshuka",
    title: "Shakshuka",
    emoji: "🍅",
    time: "25 min",
    level: "Intermediate",
    difficulty: 3,
    skill: "Poach",
    blurb: "Eggs poached in a spiced tomato sauce — a one-pan brunch hero.",
    ingredients: [
      { name: "Eggs", amount: "4" },
      { name: "Tomato", amount: "4, chopped" },
      { name: "Onion", amount: "1" },
      { name: "Garlic", amount: "3 cloves" },
      { name: "Olive oil", amount: "2 tbsp" },
      { name: "Chili flakes", amount: "1/2 tsp" },
    ],
    tools: ["Skillet"],
    steps: [
      {
        title: "Build the sauce",
        body: "Soften onion, garlic and chili in oil, then add tomatoes and simmer thick.",
        stepType: "heat",
        why: "The sauce must be thick enough to hold wells — watery sauce swallows the eggs.",
        doneness: "A spoon dragged through leaves a trail that holds for a second.",
      },
      {
        title: "Make wells",
        body: "Make little wells in the sauce with a spoon.",
        stepType: "prep",
        why: "Wells keep each egg contained so the whites set in place.",
      },
      {
        title: "Add eggs",
        body: "Crack an egg into each well, cover, and cook until whites set but yolks stay soft.",
        stepType: "heat",
        why: "Covering traps steam to cook the tops without flipping or overcooking the yolks.",
        doneness: "Whites fully opaque; yolks still wobble when you nudge the pan.",
      },
      {
        title: "Serve",
        body: "Finish with a drizzle of olive oil and serve with bread.",
        stepType: "plate",
        why: "Raw olive oil at the end adds aroma that cooking would have burned off.",
      },
    ],
    remyNote: "Cover the pan so the egg tops steam-set while the yolks stay runny.",
  },
  {
    id: "spinach-frittata",
    title: "Spinach & parmesan frittata",
    emoji: "🥬",
    time: "22 min",
    level: "Easy+",
    difficulty: 2,
    skill: "Bake",
    blurb: "A fridge-clear-out frittata that's good hot or cold.",
    ingredients: [
      { name: "Eggs", amount: "6" },
      { name: "Spinach", amount: "2 handfuls" },
      { name: "Parmesan", amount: "40 g" },
      { name: "Onion", amount: "1/2" },
      { name: "Butter", amount: "1 tbsp" },
    ],
    tools: ["Skillet", "Sheet pan"],
    steps: [
      {
        title: "Wilt spinach",
        body: "Soften onion in butter, add spinach until just wilted.",
        stepType: "heat",
        why: "Pre-wilting drives off water that would otherwise make the frittata soggy.",
        doneness: "Spinach collapsed but still bright green.",
      },
      {
        title: "Add eggs",
        body: "Pour in beaten eggs with parmesan; cook until edges set.",
        stepType: "heat",
        why: "Setting the edges on the stovetop builds a base so the middle bakes evenly.",
        doneness: "Edges firm and pulling from the pan; center still loose.",
      },
      {
        title: "Finish in oven",
        body: "Transfer to the oven and bake until the center is just firm.",
        stepType: "heat",
        why: "Gentle all-around oven heat sets the middle without burning the bottom.",
        doneness: "Center springs back to a light touch; no liquid wobble.",
      },
      {
        title: "Rest",
        body: "Let it rest 5 minutes before slicing.",
        stepType: "rest",
        why: "Resting lets the curd finish setting so slices hold together.",
      },
    ],
    remyNote: "Pull it while the middle still wobbles slightly — carryover heat finishes it.",
  },
  {
    id: "lemon-butter-rice",
    title: "Lemon butter rice",
    emoji: "🍋",
    time: "20 min",
    level: "Easy",
    difficulty: 1,
    skill: "Steam",
    blurb: "Bright, buttery rice that turns leftovers into a side worth eating.",
    ingredients: [
      { name: "Rice", amount: "1 cup" },
      { name: "Lemon", amount: "1" },
      { name: "Garlic", amount: "1 clove" },
      { name: "Butter", amount: "2 tbsp" },
      { name: "Onion", amount: "1/4" },
    ],
    tools: ["Pot"],
    steps: [
      {
        title: "Toast the rice",
        body: "Sauté garlic and onion in butter, add rice and toast 1 minute.",
        stepType: "heat",
        why: "Toasting coats each grain in fat so they cook separate and fluffy, not gluey.",
        doneness: "Grains smell faintly nutty and look chalky-white.",
      },
      {
        title: "Steam",
        body: "Add water, cover, and cook low until tender.",
        stepType: "heat",
        why: "A tight lid traps exactly the steam the rice needs — peeking lets it escape.",
        doneness: "Water absorbed, little steam holes on the surface, grains tender.",
      },
      {
        title: "Finish",
        body: "Fluff with a fork and fold in lemon zest and juice.",
        stepType: "stir",
        why: "Lemon added at the end stays bright — heat dulls its aroma.",
      },
    ],
    remyNote: "Add the lemon at the end — heat dulls its brightness.",
  },
  {
    id: "bruschetta",
    title: "Tomato garlic bruschetta",
    emoji: "🍅",
    time: "12 min",
    level: "Easy",
    difficulty: 1,
    skill: "Knife work",
    blurb: "Juicy marinated tomatoes on crisp, garlic-rubbed toast.",
    ingredients: [
      { name: "Tomato", amount: "3" },
      { name: "Garlic", amount: "1 clove" },
      { name: "Olive oil", amount: "2 tbsp" },
      { name: "Bread", amount: "4 slices" },
      { name: "Basil", amount: "6 leaves" },
    ],
    tools: ["Chef's knife", "Sheet pan"],
    steps: [
      {
        title: "Dice & marinate tomatoes",
        body: "Dice tomatoes, toss with olive oil, torn basil and salt; let sit.",
        stepType: "chop",
        why: "Salting early pulls out tomato juice, which becomes the dressing.",
      },
      {
        title: "Toast bread",
        body: "Toast bread until crisp and golden.",
        stepType: "heat",
        why: "A crisp surface won't go soggy under the juicy topping.",
        doneness: "Deep golden with crunchy edges; sounds hollow when tapped.",
      },
      {
        title: "Assemble",
        body: "Rub toast with raw garlic, spoon over the tomatoes.",
        stepType: "plate",
        why: "Rubbing garlic on hot toast grates just enough — rawer and brighter than cooking it.",
      },
    ],
    remyNote: "Salt the tomatoes early so they release their juices.",
  },
  {
    id: "veggie-stir-fry",
    title: "Veggie stir-fry & rice",
    emoji: "🥦",
    time: "20 min",
    level: "Easy+",
    difficulty: 2,
    skill: "Wok toss",
    blurb: "High heat, quick toss — crisp vegetables over fluffy rice.",
    ingredients: [
      { name: "Rice", amount: "2 cups cooked" },
      { name: "Onion", amount: "1" },
      { name: "Garlic", amount: "2 cloves" },
      { name: "Bell pepper", amount: "1" },
      { name: "Broccoli", amount: "1 cup" },
      { name: "Soy sauce", amount: "2 tbsp" },
    ],
    tools: ["Skillet", "Wood spoon"],
    steps: [
      {
        title: "Chop everything first",
        body: "Cut all the veg into even, bite-size pieces before you turn on the heat — stir-fry moves fast.",
        stepType: "chop",
        why: "Even pieces cook at the same rate; once the pan is hot there's no time to chop.",
      },
      {
        title: "Sear hard",
        body: "Get the pan smoking, add veg in order of toughness, keep them moving.",
        stepType: "heat",
        why: "High heat chars the outside before the inside softens — that's wok flavor.",
        doneness: "Charred spots on the edges but veg still snaps when bitten.",
      },
      {
        title: "Season",
        body: "Add garlic last, splash soy sauce, toss and serve over rice.",
        stepType: "stir",
        why: "Garlic added late survives the heat; added early it burns and turns bitter.",
      },
    ],
    remyNote: "Don't crowd the pan — steamed veg won't get that smoky char.",
  },
  {
    id: "scrambled-eggs-toast",
    title: "Soft scrambled eggs on toast",
    emoji: "🍳",
    time: "10 min",
    level: "Easy",
    difficulty: 1,
    skill: "Eggs",
    blurb: "Creamy, barely-set scramble — the ultimate low-and-slow win.",
    ingredients: [
      { name: "Eggs", amount: "3" },
      { name: "Butter", amount: "1 tbsp" },
      { name: "Bread", amount: "2 slices" },
    ],
    tools: ["Skillet", "Wood spoon"],
    steps: [
      {
        title: "Low heat",
        body: "Melt butter over low. Add beaten eggs.",
        stepType: "heat",
        why: "Eggs scramble between 60–70°C; low heat gives you a wide window instead of seconds.",
        doneness: "Butter melted and barely sizzling — quiet pan, not crackling.",
      },
      {
        title: "Stir constantly",
        body: "Stir slowly and constantly, pulling curds off the bottom.",
        stepType: "stir",
        why: "Constant motion makes many small creamy curds instead of one rubbery sheet.",
      },
      {
        title: "Pull early & plate",
        body: "Take them off while still glossy and soft; serve on toast.",
        stepType: "plate",
        why: "Eggs keep cooking off the heat — what looks underdone in the pan is perfect on the plate.",
      },
    ],
    remyNote: "Take them off the heat 10 seconds before they look done.",
  },
  {
    id: "pasta-pomodoro",
    title: "Pasta pomodoro",
    emoji: "🍝",
    time: "25 min",
    level: "Easy+",
    difficulty: 2,
    skill: "Simmer",
    blurb: "A simple, sweet tomato sauce that tastes like more than its parts.",
    ingredients: [
      { name: "Pasta", amount: "200 g" },
      { name: "Tomato", amount: "5" },
      { name: "Garlic", amount: "2 cloves" },
      { name: "Olive oil", amount: "2 tbsp" },
      { name: "Onion", amount: "1/2" },
      { name: "Parmesan", amount: "30 g" },
    ],
    tools: ["Pot", "Skillet"],
    steps: [
      {
        title: "Start the sauce",
        body: "Soften onion and garlic in olive oil, add tomatoes and simmer 15 min.",
        stepType: "heat",
        why: "Slow simmering concentrates the tomatoes' sugar — that's where the sweetness comes from.",
        doneness: "Sauce thick enough to coat a spoon; oil pooling slightly at the edges.",
      },
      {
        title: "Cook pasta",
        body: "Boil pasta to al dente in salted water.",
        stepType: "heat",
        why: "Salted water is your only chance to season the pasta itself.",
        doneness: "Firm bite at the center; one minute shy of packet time.",
      },
      {
        title: "Marry them",
        body: "Toss pasta in the sauce with a splash of pasta water.",
        stepType: "stir",
        why: "Finishing pasta IN the sauce lets it absorb flavor; sauce-on-top just sits there.",
      },
      {
        title: "Finish",
        body: "Grate over parmesan and serve.",
        stepType: "plate",
        why: "Freshly grated cheese melts into the hot pasta — pre-grated is coated to stop exactly that.",
      },
    ],
    remyNote: "Let the sauce reduce until it coats a spoon before adding pasta.",
  },
  {
    id: "garlic-fried-rice",
    title: "Garlic fried rice",
    emoji: "🍚",
    time: "15 min",
    level: "Easy",
    difficulty: 1,
    skill: "Wok toss",
    blurb: "Toasty garlic and crisp rice — minimalist comfort food.",
    ingredients: [
      { name: "Rice", amount: "2 cups cooked" },
      { name: "Garlic", amount: "4 cloves" },
      { name: "Eggs", amount: "1" },
      { name: "Butter", amount: "1 tbsp" },
      { name: "Green onion", amount: "1 stalk" },
    ],
    tools: ["Skillet", "Wood spoon"],
    steps: [
      {
        title: "Crisp the garlic",
        body: "Gently fry minced garlic in butter until golden and crisp; reserve some for topping.",
        stepType: "heat",
        why: "Slow frying turns garlic into crunchy chips; rushed garlic is burnt powder.",
        doneness: "Even gold color, fizzing slowed almost to a stop.",
      },
      {
        title: "Fry rice",
        body: "Add cold rice and press to sear before tossing.",
        stepType: "heat",
        why: "Cold rice is dry rice — it crisps where fresh rice would steam and clump.",
        doneness: "Audible crackle; bottom layer lightly golden when you lift it.",
      },
      {
        title: "Finish",
        body: "Push aside, scramble the egg, fold through with green onion.",
        stepType: "stir",
        why: "Scrambling in the same pan keeps the egg in ribbons through the rice.",
      },
    ],
    remyNote: "Reserve half the crisped garlic to scatter on top at the end.",
  },
  {
    id: "caprese-salad",
    title: "Caprese salad",
    emoji: "🍅",
    time: "10 min",
    level: "Easy",
    difficulty: 1,
    skill: "Assembly",
    blurb: "Ripe tomato, fresh mozzarella, basil — let good ingredients speak.",
    ingredients: [
      { name: "Tomato", amount: "2 large" },
      { name: "Mozzarella", amount: "1 ball" },
      { name: "Basil", amount: "8 leaves" },
      { name: "Olive oil", amount: "2 tbsp" },
    ],
    tools: ["Chef's knife"],
    steps: [
      {
        title: "Slice",
        body: "Slice tomato and mozzarella into even rounds.",
        stepType: "chop",
        why: "Even slices mean every bite has the same tomato-to-cheese ratio.",
      },
      {
        title: "Layer",
        body: "Alternate slices with basil leaves.",
        stepType: "plate",
        why: "Whole basil leaves between layers perfume each bite without bruising.",
      },
      {
        title: "Dress",
        body: "Drizzle olive oil, season with flaky salt and pepper.",
        stepType: "plate",
        why: "Salt right before serving — earlier and it pulls water out, making puddles.",
      },
    ],
    remyNote: "Salt the tomatoes a few minutes before serving for deeper flavor.",
  },
  {
    id: "chicken-rice",
    title: "One-pan chicken & rice",
    emoji: "🍗",
    time: "45 min",
    level: "Intermediate",
    difficulty: 3,
    skill: "Braise",
    blurb: "Golden chicken and savory rice cooked together in one pan.",
    ingredients: [
      { name: "Chicken thighs", amount: "4" },
      { name: "Rice", amount: "1.5 cups" },
      { name: "Onion", amount: "1" },
      { name: "Garlic", amount: "3 cloves" },
      { name: "Vegetable broth", amount: "3 cups" },
      { name: "Olive oil", amount: "1 tbsp" },
    ],
    tools: ["Skillet", "Wood spoon"],
    steps: [
      {
        title: "Sear chicken",
        body: "Brown the chicken skin-side down, then set aside.",
        stepType: "heat",
        why: "The browned crust is flavor that will dissolve into the rice as it cooks.",
        doneness: "Skin releases from the pan without tearing and is deep golden.",
      },
      {
        title: "Aromatics & rice",
        body: "Soften onion and garlic, toast rice in the fat.",
        stepType: "heat",
        why: "Toasting rice in chicken fat seasons every grain from the inside.",
        doneness: "Rice edges turn translucent and smell nutty.",
      },
      {
        title: "Braise",
        body: "Add broth, nestle chicken back in, cover and cook until rice is tender.",
        stepType: "heat",
        why: "Cooking covered lets chicken juices drip into the rice — the whole point of one-pan.",
        doneness: "Liquid absorbed, rice tender, chicken juices run clear (75°C at the thickest part).",
      },
      {
        title: "Rest",
        body: "Rest 5 minutes off heat before serving.",
        stepType: "rest",
        why: "Resting lets the bottom layer of rice release from the pan and juices settle.",
      },
    ],
    remyNote: "Don't move the chicken until it releases easily — that's the golden crust forming.",
  },
  {
    id: "lemon-spinach",
    title: "Lemon butter spinach",
    emoji: "🥬",
    time: "8 min",
    level: "Easy",
    difficulty: 1,
    skill: "Sauté",
    blurb: "A fast, bright green side that goes with almost anything.",
    ingredients: [
      { name: "Spinach", amount: "4 handfuls" },
      { name: "Butter", amount: "1 tbsp" },
      { name: "Garlic", amount: "1 clove" },
      { name: "Lemon", amount: "1/2" },
    ],
    tools: ["Skillet"],
    steps: [
      {
        title: "Bloom garlic",
        body: "Melt butter, add sliced garlic until just fragrant.",
        stepType: "heat",
        why: "Thirty seconds releases the aroma; longer starts the march toward bitter.",
        doneness: "Fragrant and sizzling softly, still pale.",
      },
      {
        title: "Wilt",
        body: "Add spinach in handfuls, tossing until just wilted.",
        stepType: "heat",
        why: "Spinach is mostly water — handfuls keep the pan hot enough to wilt, not boil.",
        doneness: "Just collapsed and glossy, still vivid green.",
      },
      {
        title: "Brighten",
        body: "Squeeze over lemon, season, and serve immediately.",
        stepType: "plate",
        why: "Acid balances the butter; waiting lets the lemon dull the green.",
      },
    ],
    remyNote: "Spinach wilts in seconds — have everything ready before it hits the pan.",
  },
  {
    id: "cheesy-baked-eggs",
    title: "Cheesy baked eggs",
    emoji: "🧀",
    time: "20 min",
    level: "Easy",
    difficulty: 1,
    skill: "Bake",
    blurb: "Eggs baked over tomato and spinach with a parmesan lid.",
    ingredients: [
      { name: "Eggs", amount: "4" },
      { name: "Tomato", amount: "2" },
      { name: "Spinach", amount: "2 handfuls" },
      { name: "Parmesan", amount: "40 g" },
      { name: "Olive oil", amount: "1 tbsp" },
    ],
    tools: ["Skillet", "Sheet pan"],
    steps: [
      {
        title: "Base",
        body: "Soften tomato and spinach in olive oil.",
        stepType: "heat",
        why: "Cooking the veg first drives off water so the eggs bake instead of steam.",
        doneness: "Tomato softened and juicy, spinach wilted, little liquid left in the pan.",
      },
      {
        title: "Add eggs",
        body: "Crack eggs over the top, scatter parmesan.",
        stepType: "prep",
        why: "Cheese on top browns into a lid that insulates the yolks.",
      },
      {
        title: "Bake",
        body: "Bake until whites set and cheese is golden.",
        stepType: "heat",
        why: "Gentle oven heat sets whites evenly — no flipping, no broken yolks.",
        doneness: "Whites fully set, cheese golden and bubbling, yolks still jiggle.",
      },
    ],
    remyNote: "Pull them when the whites are just set — the yolks finish on the way to the table.",
  },
  {
    id: "minestrone",
    title: "Quick minestrone",
    emoji: "🥕",
    time: "35 min",
    level: "Easy+",
    difficulty: 2,
    skill: "Simmer",
    blurb: "A clean-out-the-crisper vegetable soup with pasta.",
    ingredients: [
      { name: "Onion", amount: "1" },
      { name: "Garlic", amount: "2 cloves" },
      { name: "Tomato", amount: "3" },
      { name: "Carrot", amount: "2" },
      { name: "Pasta", amount: "1/2 cup" },
      { name: "Vegetable broth", amount: "4 cups" },
    ],
    tools: ["Pot", "Wood spoon"],
    steps: [
      {
        title: "Soffritto",
        body: "Soften onion, garlic and carrot in olive oil.",
        stepType: "heat",
        why: "This slow-cooked base is the flavor backbone of nearly every Italian soup.",
        doneness: "Vegetables soft and sweet-smelling, no browning.",
      },
      {
        title: "Simmer",
        body: "Add tomato and broth; simmer until veg is tender.",
        stepType: "heat",
        why: "Gentle bubbles cook the vegetables through without battering them to mush.",
        doneness: "Carrot yields to a fork; broth tastes rounded, not raw.",
      },
      {
        title: "Add pasta",
        body: "Stir in pasta and cook until just done.",
        stepType: "heat",
        why: "Cooking pasta in the soup releases starch that gives the broth body.",
        doneness: "Pasta tender with a slight bite; it keeps softening in the hot broth.",
      },
    ],
    remyNote: "Cook the pasta right in the soup so it soaks up flavor.",
  },
];
