import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Bookmark,
  Camera,
  Check,
  CheckCircle2,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Flame,
  Home,
  ImagePlus,
  MapPin,
  Pause,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Star,
  Store,
  ExternalLink,
  Tag,
  Timer,
  TrendingDown,
  TrendingUp,
  User,
  Utensils,
  Volume2,
  X,
  Zap,
} from "lucide-react-native";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  useFonts as useSansFonts,
} from "@expo-google-fonts/dm-sans";
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  useFonts as useDisplayFonts,
} from "@expo-google-fonts/space-grotesk";
import HandTrackingView from "./live/HandTrackingView";
import { createCoach } from "./live/coach";
import type { ActionLabel } from "./live/action";
import type { GestureCommandEvent } from "./live/gestureCommands";
import type { GripResult } from "./live/grip";
import { createSpeechCoach, type SpeechSeverity } from "./live/speechCoach";
import { inferStepType, RECIPES, stepMinutes, type Recipe } from "./data/recipes";
import {
  combineOwned,
  detectFromPhotos,
  ownedKeys,
  rankRecipes,
  scoreRecipe,
  SKILL_LEVELS,
  type RecipeScore,
  type SkillLevel,
} from "./data/matching";
import { load, save } from "./lib/storage";
import {
  completedSessions,
  computeStreak,
  deriveSkillTree,
  distinctSkills,
  type SessionRecord,
} from "./data/stats";
import {
  detectPhotos,
  generateRecipeFromBasket,
  getReviewAggregates,
  postReview,
  type ApiRecipe,
  type ReviewAggregate,
} from "./lib/api";

type Screen =
  | "onboarding"
  | "home"
  | "setup"
  | "matches"
  | "recipe"
  | "live"
  | "feedback"
  | "savings"
  | "profile";

type Nav = (screen: Screen) => void;

type IconType = React.ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

type CapturedShot = {
  id: string;
  uri: string;
  label: string;
};

const colors = {
  canvas: "#f7faf9", // cool near-white (Tech Fresh)
  earth950: "#0f172a", // slate ink
  earth900: "#1e293b",
  earth800: "#334155",
  earth600: "#64748b",
  earth400: "#94a3b8",
  earth200: "#e2e8f0",
  earth100: "#f1f5f9",
  white: "#ffffff",
  warm: "#d97706", // amber accent
  warmSoft: "#fdecd2",
  leaf: "#059669", // fresh green (primary)
  leafSoft: "#d6f3e4",
};

const pantry = [
  { name: "Eggs", emoji: "🥚" },
  { name: "Pasta", emoji: "🍝" },
  { name: "Garlic", emoji: "🧄" },
  { name: "Olive oil", emoji: "🫒" },
  { name: "Onion", emoji: "🧅" },
  { name: "Butter", emoji: "🧈" },
  { name: "Tomato", emoji: "🍅" },
  { name: "Lemon", emoji: "🍋" },
  { name: "Rice", emoji: "🍚" },
  { name: "Spinach", emoji: "🥬" },
  { name: "Parmesan", emoji: "🧀" },
  { name: "Chili flakes", emoji: "🌶️" },
];

const tools = ["Skillet", "Pot", "Sheet pan", "Chef's knife", "Wood spoon"];

const labelCycle = ["Fridge", "Pantry", "Counter", "Spice rack", "Freezer"];

type Session = { done: number; total: number; secs: number };

/** Map a backend-generated recipe (POST /recipe) onto the app's Recipe shape. */
function apiRecipeToRecipe(r: ApiRecipe): Recipe {
  const rec = r.missingButRecommended[0];
  return {
    id: `remy-live-${r.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
    title: r.title,
    emoji: "✨",
    time: `${r.timeMinutes} min`,
    level: `Serves ${r.servings}`,
    skill: "Improvise",
    blurb: r.description,
    difficulty: 2,
    ingredients: r.usesFromInventory.map((name) => ({ name, amount: "from your basket" })),
    tools: [],
    steps: r.steps.map((body, i) => ({
      title: body.split(/[,.]/)[0]!.slice(0, 48) || `Step ${i + 1}`,
      body,
      stepType: inferStepType(body),
    })),
    remyNote: rec
      ? `Nice-to-have: ${rec.name} — ${rec.why}`
      : "Built from exactly what you have on hand.",
  };
}

/** Catches render errors so a bug shows a friendly card instead of a white screen. */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <View style={styles.errFull}>
          <Text style={styles.errEmoji}>🍳</Text>
          <Text style={styles.errTitle}>Something went sideways.</Text>
          <Text style={styles.errBody}>{String(this.state.error.message ?? this.state.error)}</Text>
          <Pressable style={styles.errBtn} onPress={() => this.setState({ error: null })}>
            <Text style={styles.errBtnText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(() =>
    load("remy.onboarded", false) ? "home" : "onboarding",
  );
  const [shots, setShots] = useState<CapturedShot[]>([]);
  const [found, setFound] = useState<string[]>([]);
  const [owned, setOwned] = useState<string[]>(() => load("remy.owned", []));
  const [scores, setScores] = useState<RecipeScore[]>([]);
  const [pick, setPick] = useState<RecipeScore | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>(() => load("remy.saved", []));
  const [lastSession, setLastSession] = useState<{ recipeId: string; step: number } | null>(
    () => load("remy.lastSession", null),
  );
  const [resumeStep, setResumeStep] = useState(0);
  const [history, setHistory] = useState<SessionRecord[]>(() => load("remy.history", []));
  const [sessionResult, setSessionResult] = useState<Session | null>(null);
  const [pref, setPref] = useState<string>(() => load("remy.pref", "No restrictions"));
  const [skill, setSkill] = useState<SkillLevel>(() => load("remy.skill", "beginner"));
  const [featured, setFeatured] = useState<Recipe | null>(null);
  const [featuredState, setFeaturedState] = useState<"idle" | "loading" | "ready" | "offline">(
    "idle",
  );
  const [sansLoaded] = useSansFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });
  const [displayLoaded] = useDisplayFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  if (!sansLoaded || !displayLoaded) {
    return <View style={styles.loading} />;
  }

  const recipe = pick?.recipe ?? RECIPES[0]!;
  const missing = pick?.missing ?? [];
  const savedRecipes = RECIPES.filter((r) => savedIds.includes(r.id));
  const sessions = completedSessions(history);
  const streak = computeStreak(history, Date.now());
  const skillTree = deriveSkillTree(history);
  const skillsPracticed = distinctSkills(history);
  const resumeRecipe = lastSession
    ? (RECIPES.find((r) => r.id === lastSession.recipeId) ?? null)
    : null;

  /** Navigation that also marks onboarding as seen, so refreshes go to Home. */
  const go: Nav = (next) => {
    if (screen === "onboarding" && next !== "onboarding") {
      save("remy.onboarded", true);
    }
    setScreen(next);
  };

  const suggest = (selected: string[]) => {
    // The basket already contains confirmed scan results (Setup's review step),
    // so "what you own" is exactly what the user approved + typed.
    const all = combineOwned(selected, []);
    setOwned(all);
    save("remy.owned", all);
    setScores(rankRecipes(ownedKeys(all), RECIPES, skill));
    // PRIMARY recipe source: backend POST /recipe with the actual basket.
    // The local 18-recipe DB list below it is the offline/error fallback path.
    setFeatured(null);
    setFeaturedState("loading");
    // Honor the dietary preference set in Profile (skip the neutral default).
    const preference = pref && pref !== "No restrictions" ? pref : undefined;
    generateRecipeFromBasket(all, preference)
      .then((r) => {
        setFeatured(apiRecipeToRecipe(r));
        setFeaturedState("ready");
      })
      .catch(() => setFeaturedState("offline"));
    go("matches");
  };

  const choose = (score: RecipeScore) => {
    setPick(score);
    setResumeStep(0);
    go("recipe");
  };

  const openSaved = (r: Recipe) => {
    setPick(scoreRecipe(ownedKeys(owned), r));
    setResumeStep(0);
    go("recipe");
  };

  const toggleSave = (id: string) => {
    setSavedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      save("remy.saved", next);
      return next;
    });
  };

  const resume = () => {
    if (!resumeRecipe || !lastSession) return;
    setPick(scoreRecipe(ownedKeys(owned), resumeRecipe));
    setResumeStep(lastSession.step);
    go("live");
  };

  const onLiveProgress = (step: number) => {
    const next = { recipeId: recipe.id, step };
    setLastSession(next);
    save("remy.lastSession", next);
  };

  const finishSession = (done: number, total: number, secs: number) => {
    setSessionResult({ done, total, secs });
    // Every number in the UI derives from this persisted history.
    setHistory((prev) => {
      const next = [
        ...prev,
        { at: Date.now(), recipeId: recipe.id, skill: recipe.skill, done, total },
      ];
      save("remy.history", next);
      return next;
    });
    setLastSession(null);
    save("remy.lastSession", null);
    go("feedback");
  };

  const cyclePref = () => {
    const opts = ["No restrictions", "Vegetarian", "Vegan", "Gluten-free", "Halal"];
    const next = opts[(opts.indexOf(pref) + 1) % opts.length]!;
    setPref(next);
    save("remy.pref", next);
  };

  const cycleSkill = () => {
    const next = SKILL_LEVELS[(SKILL_LEVELS.indexOf(skill) + 1) % SKILL_LEVELS.length]!;
    setSkill(next);
    save("remy.skill", next);
  };

  /** "Clear what Remy remembers" — wipe persisted state and start fresh. */
  const resetAll = () => {
    save("remy.saved", []);
    save("remy.history", []);
    save("remy.owned", []);
    save("remy.lastSession", null);
    save("remy.pref", "No restrictions");
    save("remy.basket", ["Pasta", "Garlic", "Olive oil", "Parmesan", "Chili flakes"]);
    save("remy.onboarded", false);
    setSavedIds([]);
    setHistory([]);
    setOwned([]);
    setLastSession(null);
    setPref("No restrictions");
    setPick(null);
    setScores([]);
    setFound([]);
    setShots([]);
    setSessionResult(null);
    setScreen("onboarding");
  };

  return (
    <ErrorBoundary>
      <StatusBar style={screen === "live" || screen === "onboarding" ? "light" : "dark"} />
      {screen === "onboarding" && <OnboardingScreen nav={go} />}
      {screen === "home" && (
        <HomeScreen
          nav={go}
          savedRecipes={savedRecipes}
          onOpenSaved={openSaved}
          resume={resumeRecipe && lastSession ? { recipe: resumeRecipe, step: lastSession.step } : null}
          onResume={resume}
          sessions={sessions}
          streak={streak}
          skillsPracticed={skillsPracticed}
        />
      )}
      {screen === "setup" && (
        <SetupScreen
          nav={go}
          shots={shots}
          setShots={setShots}
          onSuggest={suggest}
          onConfirmScan={setFound}
        />
      )}
      {screen === "matches" && (
        <MatchesScreen
          nav={go}
          found={found}
          owned={owned}
          scores={scores}
          onPick={choose}
          featured={featured}
          featuredState={featuredState}
          onPickFeatured={() => featured && openSaved(featured)}
        />
      )}
      {screen === "recipe" && (
        <RecipeScreen
          nav={go}
          recipe={recipe}
          missing={missing}
          saved={savedIds.includes(recipe.id)}
          onToggleSave={toggleSave}
        />
      )}
      {screen === "live" && (
        <LiveScreen
          nav={go}
          recipe={recipe}
          initialStep={resumeStep}
          onProgress={onLiveProgress}
          onFinish={finishSession}
        />
      )}
      {screen === "feedback" && (
        <FeedbackScreen nav={go} recipe={recipe} session={sessionResult} />
      )}
      {screen === "savings" && (
        <SavingsScreen nav={go} missing={missing} cooking={pick ? pick.recipe.title : null} />
      )}
      {screen === "profile" && (
        <ProfileScreen
          nav={go}
          savedRecipes={savedRecipes}
          onOpenSaved={openSaved}
          sessions={sessions}
          streak={streak}
          skillTree={skillTree}
          pref={pref}
          onCyclePref={cyclePref}
          skill={skill}
          onCycleSkill={cycleSkill}
          onReset={resetAll}
        />
      )}
    </ErrorBoundary>
  );
}

function Shell({
  children,
  nav,
  active,
  hideNav,
  bleed,
  footer,
}: {
  children: React.ReactNode;
  nav: Nav;
  active: Screen;
  hideNav?: boolean;
  bleed?: boolean;
  /** Pinned action area rendered above the bottom nav (always reachable). */
  footer?: React.ReactNode;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.shell,
          bleed ? styles.shellBleed : null,
          hideNav ? styles.shellHideNav : null,
          footer ? styles.shellWithFooter : null,
        ]}
      >
        {children}
      </ScrollView>
      {footer && <View style={styles.stickyFooter}>{footer}</View>}
      {!hideNav && <BottomNav nav={nav} active={active} />}
    </SafeAreaView>
  );
}

/**
 * Layered card surface — one consistent radius/padding + a soft shadow so cards
 * read as raised, not flat hairline boxes. `tone` swaps the accent background.
 */
function Card({
  children,
  tone = "white",
  style,
}: {
  children: React.ReactNode;
  tone?: "white" | "warm" | "leaf" | "panel";
  style?: object;
}) {
  const toneStyle =
    tone === "warm"
      ? styles.cardWarm
      : tone === "leaf"
        ? styles.cardLeaf
        : tone === "panel"
          ? styles.cardPanel
          : styles.cardWhite;
  return <View style={[styles.cardBase, toneStyle, style]}>{children}</View>;
}

/** Tappable card — `Card` with min 44px hit area + press feedback (micro-interaction). */
function Tile({
  children,
  tone = "white",
  onPress,
  style,
}: {
  children: React.ReactNode;
  tone?: "white" | "warm" | "leaf" | "panel";
  onPress?: () => void;
  style?: object;
}) {
  const toneStyle =
    tone === "warm"
      ? styles.cardWarm
      : tone === "leaf"
        ? styles.cardLeaf
        : tone === "panel"
          ? styles.cardPanel
          : styles.cardWhite;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.cardBase, toneStyle, style, pressed ? styles.tilePressed : null]}
    >
      {children}
    </Pressable>
  );
}

/** Animated scan progress bar (fills over `duration` ms). */
function ScanBar({ duration = 2000 }: { duration?: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [anim, duration]);
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ["6%", "100%"] });
  return (
    <View style={styles.scanBarTrack}>
      <Animated.View style={[styles.scanBarFill, { width }]} />
    </View>
  );
}

/** Vivid gradient tile — same shape as Tile, but with a gradient fill + glow. */
function GradientTile({
  children,
  colors: gradColors,
  onPress,
  style,
}: {
  children: React.ReactNode;
  colors: [string, string];
  onPress?: () => void;
  style?: object;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.cardBase,
        styles.gradientTile,
        // solid fallback + matching glow, in case the gradient layer fails
        { shadowColor: gradColors[1], backgroundColor: gradColors[1] },
        style,
        pressed ? styles.tilePressed : null,
      ]}
    >
      <LinearGradient
        colors={gradColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </Pressable>
  );
}

/** Entrance animation: fades + lifts its children on mount. Stagger via `delay`. */
function FadeInUp({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: object;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      delay,
      friction: 8,
      tension: 70,
      useNativeDriver: false,
    }).start();
  }, [anim, delay]);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [32, 0] });
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const opacity = anim.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [0, 1, 1],
    extrapolate: "clamp",
  });
  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }, { scale }] }]}>
      {children}
    </Animated.View>
  );
}

function OnboardingScreen({ nav }: { nav: Nav }) {
  const steps = [
    {
      icon: Sparkles,
      title: "A coach for everyday skills.",
      body: "Remy helps you learn things hands-on - starting with cooking. Friendly guidance, never judgmental.",
    },
    {
      icon: Camera,
      title: "Watches with you, gently.",
      body: "Point your camera at the pan. Remy offers small nudges in the moment, then a calm recap afterwards.",
    },
    {
      icon: Timer,
      title: "Practical. Affordable. Yours.",
      body: "Get cheaper ingredient swaps, sale-aware ideas, and small wins that build real kitchen confidence.",
    },
  ];

  return (
    <View style={styles.onboardingDark}>
      <LinearGradient
        colors={["#0f172a", "#0b3b2e", "#020617"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* ambient glow blobs */}
      <View style={[styles.glowBlob, styles.glowGreen]} />
      <View style={[styles.glowBlob, styles.glowAmber]} />

      <SafeAreaView style={styles.flex1}>
        <View style={styles.onboarding}>
          <FadeInUp>
            <View style={styles.onboardBadge}>
              <ChefHat size={14} color="#34d399" />
              <Text style={styles.onboardBadgeText}>REMY · AI KITCHEN COACH</Text>
            </View>
            <Text style={[styles.heroDarkTitle, styles.mt16]}>
              Cook with{"\n"}
              <Text style={styles.heroAccent}>superpowers.</Text>
            </Text>
            <Text style={[styles.heroDarkBody, styles.mt16]}>
              Real-time nudges while you cook, plus a warm recap when the plate
              is down.
            </Text>
          </FadeInUp>

          <View style={styles.stepList}>
            {steps.map((step, i) => {
              const Icon = step.icon;
              const leaf = i % 2 === 1;
              return (
                <FadeInUp key={step.title} delay={150 + i * 120}>
                  <View style={styles.glassRow}>
                    <View style={[styles.glassIcon, leaf ? styles.glassIconLeaf : null]}>
                      <Icon size={20} color={leaf ? "#34d399" : "#fbbf24"} strokeWidth={2} />
                    </View>
                    <View style={styles.flex1}>
                      <Text style={styles.glassTitle}>{step.title}</Text>
                      <Text style={styles.glassBody}>{step.body}</Text>
                    </View>
                  </View>
                </FadeInUp>
              );
            })}
          </View>

          <View style={styles.pushBottom}>
            <FadeInUp delay={560}>
              <PrimaryButton label="Let's cook" icon={ArrowRight} onPress={() => nav("home")} />
              <Text style={styles.smallCenterDark}>
                Suggestions are guidance, not gospel. You're the chef.
              </Text>
            </FadeInUp>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function HomeScreen({
  nav,
  savedRecipes,
  onOpenSaved,
  resume,
  onResume,
  sessions,
  streak,
  skillsPracticed,
}: {
  nav: Nav;
  savedRecipes: Recipe[];
  onOpenSaved: (r: Recipe) => void;
  resume: { recipe: Recipe; step: number } | null;
  onResume: () => void;
  sessions: number;
  streak: number;
  skillsPracticed: number;
}) {
  return (
    <Shell
      nav={nav}
      active="home"
      footer={
        <>
          <PrimaryButton
            label="Start a new session"
            icon={Flame}
            onPress={() => nav("setup")}
          />
          <Text style={styles.stickyHint}>We'll suggest recipes from what you have.</Text>
        </>
      }
    >
      {/* Dark hero band */}
      <FadeInUp>
        <View style={styles.heroDark}>
          <LinearGradient
            colors={["#0f172a", "#0b3b2e"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.heroEyebrow}>Good afternoon, Alex</Text>
          <Text style={styles.heroTitle}>
            The kitchen{"\n"}
            <Text style={styles.heroAccent}>is yours.</Text>
          </Text>
          <View style={styles.heroChips}>
            <View style={styles.heroChip}>
              <Sparkles size={12} color="#34d399" />
              <Text style={styles.heroChipText}>
                {sessions} cook{sessions === 1 ? "" : "s"} done
              </Text>
            </View>
            <View style={styles.heroChip}>
              <Flame size={12} color="#fbbf24" />
              <Text style={styles.heroChipText}>
                {streak}-day streak
              </Text>
            </View>
            <View style={styles.heroChip}>
              <Bookmark size={12} color="#f87171" />
              <Text style={styles.heroChipText}>{savedRecipes.length} saved</Text>
            </View>
          </View>
        </View>
      </FadeInUp>

      {/* Bento grid: tall resume tile beside two stacked stat tiles */}
      <FadeInUp delay={110} style={[styles.bentoRow, styles.mt16]}>
        <View style={styles.bentoCol}>
          <Tile tone="white" onPress={() => nav("profile")}>
            <Text style={styles.tileLabel}>Skill tree</Text>
            <Text style={styles.tileMetric}>{skillsPracticed} / 10</Text>
            <Text style={styles.tiny}>skills practiced</Text>
            <Progress
              value={Math.min(100, skillsPracticed * 10)}
              color={colors.leaf}
              style={styles.mt12}
            />
          </Tile>
          <GradientTile colors={["#10b981", "#047857"]} onPress={() => nav("profile")}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.tileLabelLight}>Streak</Text>
                <Text style={styles.tileMetricLight}>
                  {streak} day{streak === 1 ? "" : "s"}
                </Text>
              </View>
              <View style={styles.tileIconGlass}>
                <Flame size={18} color={colors.white} />
              </View>
            </View>
          </GradientTile>
        </View>

        {resume ? (
          <GradientTile
            colors={["#f59e0b", "#d97706"]}
            onPress={onResume}
            style={styles.bentoFill}
          >
            <Text style={styles.tileEmoji}>{resume.recipe.emoji}</Text>
            <Text style={[styles.tileLabelLight, styles.mt12]}>Resume</Text>
            <Text style={styles.tileBodyLight}>{resume.recipe.title}</Text>
            <View style={styles.resumeBadge}>
              <Timer size={12} color="#b45309" />
              <Text style={styles.resumeBadgeText}>
                Step {resume.step + 1} of {resume.recipe.steps.length}
              </Text>
            </View>
          </GradientTile>
        ) : (
          <GradientTile
            colors={["#f59e0b", "#d97706"]}
            onPress={() => nav("setup")}
            style={styles.bentoFill}
          >
            <Text style={styles.tileEmoji}>🍳</Text>
            <Text style={[styles.tileLabelLight, styles.mt12]}>Tonight</Text>
            <Text style={styles.tileBodyLight}>Cook something new</Text>
            <View style={styles.resumeBadge}>
              <Sparkles size={12} color="#b45309" />
              <Text style={styles.resumeBadgeText}>Get a recipe</Text>
            </View>
          </GradientTile>
        )}
      </FadeInUp>

      <FadeInUp delay={150}>
        <SectionTitle title="Saved for later" style={styles.mt28} />
        {savedRecipes.length === 0 ? (
          <Tile tone="white" onPress={() => nav("setup")} style={styles.inlineWide}>
            <View style={styles.foodTile}>
              <Text style={styles.emojiLarge}>🔖</Text>
            </View>
            <View style={styles.flex1}>
              <Text style={styles.cardTitle}>Nothing saved yet</Text>
              <Text style={styles.tiny}>Tap Save on any recipe — it'll live here.</Text>
            </View>
            <View style={styles.roundWarm}>
              <ArrowRight size={16} color={colors.white} />
            </View>
          </Tile>
        ) : (
          savedRecipes.slice(0, 3).map((r) => (
            <Tile
              key={r.id}
              tone="white"
              onPress={() => onOpenSaved(r)}
              style={[styles.inlineWide, styles.matchCardV2]}
            >
              <View style={styles.foodTile}>
                <Text style={styles.emojiLarge}>{r.emoji}</Text>
              </View>
              <View style={styles.flex1}>
                <Text style={styles.cardTitle}>{r.title}</Text>
                <Text style={styles.tiny}>
                  {r.time} · {r.level}
                </Text>
              </View>
              <View style={styles.roundWarm}>
                <ArrowRight size={16} color={colors.white} />
              </View>
            </Tile>
          ))
        )}
      </FadeInUp>
    </Shell>
  );
}

function SetupScreen({
  nav,
  shots,
  setShots,
  onSuggest,
  onConfirmScan,
}: {
  nav: Nav;
  shots: CapturedShot[];
  setShots: (shots: CapturedShot[]) => void;
  onSuggest: (selected: string[]) => void;
  onConfirmScan: (names: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () =>
      new Set(
        load<string[]>("remy.basket", ["Pasta", "Garlic", "Olive oil", "Parmesan", "Chili flakes"]),
      ),
  );
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scanState, setScanState] = useState<"idle" | "scanning" | "review" | "done">("idle");
  const [spotted, setSpotted] = useState<string[]>([]);
  const [scanSource, setScanSource] = useState<string>("");
  const [query, setQuery] = useState("");

  // Persist the basket so a refresh doesn't lose it.
  useEffect(() => {
    save("remy.basket", [...selected]);
  }, [selected]);

  const toggle = (name: string) => {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelected(next);
  };

  const addCustom = () => {
    const q = query.trim();
    if (!q) return;
    const name = q[0]!.toUpperCase() + q.slice(1).toLowerCase();
    setSelected((prev) => new Set(prev).add(name));
    setQuery("");
  };

  const SCAN_MS = 12_000; // progress sweep ceiling; real API usually returns sooner

  /**
   * Real scan: POST photo bytes to the backend /detect. The deterministic
   * sample scan is ONLY the explicit offline/error fallback, and is labeled
   * as such in the UI. Results land in an editable review step (not the
   * basket) so the user can correct the vision model before committing.
   */
  const runScan = (allShots: CapturedShot[]) => {
    if (allShots.length === 0) return;
    setScanState("scanning");
    void (async () => {
      try {
        const res = await detectPhotos(allShots.map((s) => s.uri));
        setSpotted(res.names);
        setScanSource(`Scanned by Remy (${res.detector})`);
      } catch {
        // Offline/error fallback — sample detector, clearly labeled.
        setSpotted(detectFromPhotos(allShots));
        setScanSource("Offline sample scan — backend unreachable");
      }
      setScanState("review");
    })();
  };

  const removeSpotted = (name: string) =>
    setSpotted((prev) => prev.filter((n) => n !== name));

  const confirmSpotted = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      spotted.forEach((f) => next.add(f));
      return next;
    });
    onConfirmScan(spotted);
    setScanState("done");
  };

  // Direct upload — works everywhere (on web it's a plain file picker), so the
  // scan flow never depends on camera permissions.
  const uploadPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.82,
    });
    if (result.canceled) return;
    const next = result.assets.map((asset, index) => ({
      id: `${Date.now()}-${asset.assetId ?? index}`,
      uri: asset.uri,
      label: labelCycle[(shots.length + index) % labelCycle.length]!,
    }));
    const all = [...shots, ...next];
    setShots(all);
    runScan(all);
  };

  return (
    <Shell
      nav={nav}
      active="setup"
      footer={
        <>
          <PrimaryButton
            label={`Suggest recipes${selected.size ? ` · ${selected.size}` : ""}`}
            icon={Sparkles}
            onPress={() => onSuggest([...selected])}
          />
          <Text style={styles.stickyHint}>Remy matches recipes to what you've shown it.</Text>
        </>
      }
    >
      <Text style={styles.eyebrow}>Step 1 of 2</Text>
      <Text style={styles.serifTitle}>What do you{"\n"}have on hand?</Text>
      <Text style={[styles.bodyText, styles.mt8]}>
        Snap your fridge, or tap anything you've got - even loosely.
      </Text>

      <FadeInUp delay={60}>
        <View style={styles.scanCard}>
          <LinearGradient
            colors={["#0f172a", "#0b3b2e", "#064e3b"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.rowTop}>
            <View style={styles.scanGlowBox}>
              <Camera size={20} color={colors.white} />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.scanEyebrow}>Fastest way</Text>
              <Text style={styles.scanTitle}>Show Remy your kitchen</Text>
              <Text style={styles.scanBody}>
                Upload fridge & pantry photos — Remy works out what you can cook.
              </Text>
            </View>
          </View>

          <View style={styles.scanActions}>
            <Pressable
              style={({ pressed }) => [styles.scanPrimaryBtn, pressed ? styles.pressedBtn : null]}
              onPress={uploadPhotos}
            >
              <ImagePlus size={16} color={colors.earth950} />
              <Text style={styles.scanPrimaryBtnText}>Upload photos</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.scanGhostBtn, pressed ? styles.pressedBtn : null]}
              onPress={() => setCameraOpen(true)}
            >
              <Camera size={16} color={colors.white} />
              <Text style={styles.scanGhostBtnText}>Camera</Text>
            </Pressable>
          </View>

          {shots.length > 0 && (
            <View style={styles.shotSummary}>
              <View style={styles.shotStack}>
                {shots.slice(0, 4).map((shot) => (
                  <Image key={shot.id} source={{ uri: shot.uri }} style={styles.shotThumb} />
                ))}
              </View>
              <Text style={styles.scanBody}>
                <Text style={styles.whiteStrong}>
                  {shots.length} photo{shots.length === 1 ? "" : "s"}
                </Text>{" "}
                {scanState === "scanning" ? "— scanning…" : "scanned"}
              </Text>
            </View>
          )}

          {scanState === "scanning" && (
            <View style={styles.scanProgressWrap}>
              <Text style={styles.scanScanningText}>
                🔎 Looking for ingredients in your photo
                {shots.length === 1 ? "" : "s"}…
              </Text>
              <ScanBar duration={SCAN_MS} />
            </View>
          )}
        </View>
      </FadeInUp>

      {scanState === "review" && (
        <FadeInUp delay={40}>
          <Card tone="leaf" style={styles.mt16}>
            <View style={styles.inline}>
              <Sparkles size={14} color={colors.leaf} />
              <Text style={styles.leafEyebrow}>
                Remy spotted · {spotted.length} — confirm before adding
              </Text>
            </View>
            <Text style={styles.scanHint}>{scanSource}</Text>
            {spotted.length === 0 ? (
              <Text style={[styles.cardBody, styles.mt8]}>
                Nothing recognizable in those photos — add ingredients by hand below, or try
                clearer shots.
              </Text>
            ) : (
              <View style={[styles.chipWrap, styles.mt12]}>
                {spotted.map((name) => (
                  <Pressable
                    key={name}
                    style={({ pressed }) => [
                      styles.spottedChip,
                      pressed ? styles.pressedBtn : null,
                    ]}
                    onPress={() => removeSpotted(name)}
                  >
                    <Text style={styles.spottedChipText}>{name}</Text>
                    <X size={12} color={colors.earth600} />
                  </Pressable>
                ))}
              </View>
            )}
            <View style={styles.scanActions}>
              {spotted.length > 0 && (
                <Pressable
                  style={({ pressed }) => [
                    styles.confirmBtn,
                    pressed ? styles.pressedBtn : null,
                  ]}
                  onPress={confirmSpotted}
                >
                  <Check size={15} color={colors.white} />
                  <Text style={styles.confirmBtnText}>
                    Add {spotted.length} to basket
                  </Text>
                </Pressable>
              )}
              {scanSource.startsWith("Offline") && (
                <Pressable
                  style={({ pressed }) => [styles.dismissBtn, pressed ? styles.pressedBtn : null]}
                  onPress={() => runScan(shots)}
                >
                  <Text style={styles.dismissBtnText}>Retry live</Text>
                </Pressable>
              )}
              <Pressable
                style={({ pressed }) => [styles.dismissBtn, pressed ? styles.pressedBtn : null]}
                onPress={() => setScanState("idle")}
              >
                <Text style={styles.dismissBtnText}>Dismiss</Text>
              </Pressable>
            </View>
            <Text style={styles.scanHint}>Tap an item to remove it if Remy got it wrong.</Text>
          </Card>
        </FadeInUp>
      )}

      {scanState === "done" && (
        <FadeInUp delay={40}>
          <Card tone="leaf" style={styles.mt16}>
            <View style={styles.inline}>
              <Check size={14} color={colors.leaf} />
              <Text style={styles.leafEyebrow}>Added to your basket</Text>
            </View>
            <Text style={[styles.cardBody, styles.mt4]}>
              Tweak anything below, then hit Suggest recipes.
            </Text>
          </Card>
        </FadeInUp>
      )}

      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>or build it by hand</Text>
        <View style={styles.divider} />
      </View>

      <View style={styles.searchBox}>
        <Search size={16} color={colors.earth600} />
        <TextInput
          placeholder="Type an ingredient, press +"
          placeholderTextColor={colors.earth400}
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={addCustom}
          returnKeyType="done"
        />
        <Pressable
          style={({ pressed }) => [styles.addButton, pressed ? styles.pressedBtn : null]}
          onPress={addCustom}
          hitSlop={8}
        >
          <Plus size={16} color={colors.earth800} />
        </Pressable>
      </View>

      {selected.size > 0 && (
        <View style={styles.mt20}>
          <SectionTitle title={`In your basket · ${selected.size}`} />
          <View style={styles.chipWrap}>
            {[...selected].map((name) => (
              <Pressable key={name} style={styles.darkChip} onPress={() => toggle(name)}>
                <Text style={styles.darkChipText}>{name}</Text>
                <X size={12} color={colors.canvas} />
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <SectionTitle title="Common pantry" style={styles.mt24} />
      <View style={styles.pantryGrid}>
        {pantry.map((item) => {
          const active = selected.has(item.name);
          return (
            <Pressable
              key={item.name}
              style={[styles.pantryItem, active ? styles.pantryActive : null]}
              onPress={() => toggle(item.name)}
            >
              <Text style={styles.emojiMed}>{item.emoji}</Text>
              <Text style={[styles.pantryText, active ? styles.warmText : null]}>
                {item.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <SectionTitle title="Tools" style={styles.mt24} />
      <View style={styles.chipWrap}>
        {tools.map((tool) => (
          <View key={tool} style={styles.lightChip}>
            <Text style={styles.lightChipText}>{tool}</Text>
          </View>
        ))}
      </View>

      <KitchenCamera
        open={cameraOpen}
        onClose={() => {
          setCameraOpen(false);
          runScan(shots);
        }}
        shots={shots}
        setShots={setShots}
      />
    </Shell>
  );
}

function MatchesScreen({
  nav,
  found,
  owned,
  scores,
  onPick,
  featured,
  featuredState,
  onPickFeatured,
}: {
  nav: Nav;
  found: string[];
  owned: string[];
  scores: RecipeScore[];
  onPick: (score: RecipeScore) => void;
  featured: Recipe | null;
  featuredState: "idle" | "loading" | "ready" | "offline";
  onPickFeatured: () => void;
}) {
  const ready = scores.filter((s) => s.pct === 100).length;
  const [ratings, setRatings] = useState<Record<string, ReviewAggregate>>({});

  // Aggregate ratings from the backend review store; absence is non-fatal.
  useEffect(() => {
    getReviewAggregates()
      .then(setRatings)
      .catch(() => {});
  }, []);
  return (
    <Shell
      nav={nav}
      active="setup"
      footer={
        <>
          <PrimaryButton label="Find missing nearby" icon={Tag} onPress={() => nav("savings")} />
          <Text style={styles.stickyHint}>Short a few things? Remy finds cheap options close by.</Text>
        </>
      }
    >
      <View style={styles.rowBetween}>
        <IconButton icon={ArrowLeft} onPress={() => nav("setup")} />
        <Text style={styles.eyebrow}>Step 2 of 2</Text>
        <View style={styles.iconButtonSpacer} />
      </View>
      <Text style={[styles.serifTitle, styles.mt12]}>Recipes for{"\n"}tonight.</Text>
      <Text style={[styles.bodyText, styles.mt8]}>
        {ready > 0 ? `${ready} ready to cook now · ` : ""}
        {scores.length} matched to your kitchen.
      </Text>

      {owned.length === 0 && (
        <Card tone="warm" style={styles.mt20}>
          <Text style={styles.cardTitle}>Your basket is empty</Text>
          <Text style={styles.cardBody}>
            Go back and add a few ingredients (or upload photos) so the matches mean something.
          </Text>
        </Card>
      )}

      {found.length > 0 && (
        <Card tone="leaf" style={styles.mt20}>
          <View style={styles.inline}>
            <Camera size={14} color={colors.leaf} />
            <Text style={styles.leafEyebrow}>What Remy spotted</Text>
          </View>
          <Text style={[styles.bodyDark, styles.mt8]}>{found.join(", ")}</Text>
          <Text style={styles.scanHint}>Sample scan — tweak your list below if needed.</Text>
        </Card>
      )}

      <SectionTitle title={`Your ingredients · ${owned.length}`} style={styles.mt24} />
      <View style={styles.chipWrap}>
        {owned.map((name) => (
          <View key={name} style={styles.lightChip}>
            <Text style={styles.lightChipText}>{name}</Text>
          </View>
        ))}
      </View>

      {featuredState === "loading" && (
        <Card tone="panel" style={styles.mt20}>
          <View style={styles.inline}>
            <Sparkles size={14} color={colors.warm} />
            <Text style={styles.warmEyebrow}>Remy is writing you a recipe…</Text>
          </View>
          <Text style={[styles.cardBody, styles.mt4]}>
            Generating live from your basket on the agent layer.
          </Text>
        </Card>
      )}
      {featuredState === "ready" && featured && (
        <FadeInUp delay={30}>
          <SectionTitle title="Made for your basket · live" style={styles.mt24} />
          <GradientTile colors={["#10b981", "#047857"]} onPress={onPickFeatured}>
            <View style={styles.rowBetween}>
              <Text style={styles.tileEmoji}>✨</Text>
              <View style={styles.heroChip}>
                <Text style={styles.heroChipText}>Generated · not from the book</Text>
              </View>
            </View>
            <Text style={[styles.tileBodyLight, styles.mt8]}>{featured.title}</Text>
            <Text style={styles.featuredBlurb} numberOfLines={2}>
              {featured.blurb}
            </Text>
            <View style={styles.resumeBadge}>
              <Timer size={12} color="#047857" />
              <Text style={styles.featuredBadgeText}>{featured.time}</Text>
            </View>
          </GradientTile>
        </FadeInUp>
      )}
      {featuredState === "offline" && (
        <Card tone="panel" style={styles.mt20}>
          <Text style={styles.tiny}>
            Live recipe generation unreachable — showing Remy's cookbook matches below.
          </Text>
        </Card>
      )}

      <SectionTitle title="Best matches" style={styles.mt28} />
      {scores.slice(0, 8).map((score, i) => {
        const { recipe, pct, missing } = score;
        const full = pct === 100;
        return (
          <FadeInUp key={recipe.id} delay={i * 70}>
          <Tile onPress={() => onPick(score)} style={styles.matchCardV2}>
            <View style={styles.rowBetween}>
              <View style={styles.inlineWide}>
                <View style={[styles.matchTile, full ? styles.matchTileFull : null]}>
                  <Text style={styles.emojiMed}>{recipe.emoji}</Text>
                </View>
                <View>
                  <Text style={styles.cardTitle}>{recipe.title}</Text>
                  <Text style={styles.tiny}>
                    {recipe.time} · {recipe.level}
                    {ratings[recipe.id]
                      ? ` · ★ ${ratings[recipe.id]!.avgRecipe} (${ratings[recipe.id]!.count})`
                      : ""}
                  </Text>
                </View>
              </View>
              <View style={styles.matchPctWrap}>
                <Text style={[styles.matchPctBig, full ? styles.leafText : styles.warmText]}>
                  {pct}
                </Text>
                <Text style={styles.matchPctUnit}>%</Text>
              </View>
            </View>
            <Progress value={pct} color={full ? colors.leaf : colors.warm} style={styles.mt12} />
            <Text style={[styles.tiny, styles.mt8]}>
              {full
                ? "You have everything ✓"
                : `Missing ${missing.length}: ${missing.slice(0, 3).join(", ")}${
                    missing.length > 3 ? "…" : ""
                  }`}
            </Text>
          </Tile>
          </FadeInUp>
        );
      })}
    </Shell>
  );
}

function RecipeScreen({
  nav,
  recipe,
  missing,
  saved,
  onToggleSave,
}: {
  nav: Nav;
  recipe: Recipe;
  missing: string[];
  saved: boolean;
  onToggleSave: (id: string) => void;
}) {
  const have = recipe.ingredients.filter((i) => !missing.includes(i.name));
  const need = recipe.ingredients.filter((i) => missing.includes(i.name));

  const KitRow = ({ name, amount, isMissing }: { name: string; amount: string; isMissing: boolean }) => (
    <View style={styles.kitRow}>
      <View style={styles.inline}>
        <View style={[styles.kitDot, isMissing ? styles.kitDotMissing : styles.kitDotHave]} />
        <Text style={styles.kitName}>{name}</Text>
      </View>
      <Text style={styles.kitAmount}>{amount}</Text>
    </View>
  );

  return (
    <Shell
      nav={nav}
      active="setup"
      bleed
      footer={
        <>
          <PrimaryButton label="Enter live mode" icon={Flame} onPress={() => nav("live")} warm />
          <Text style={styles.stickyHint}>Camera coaching, on-device. Go at your own pace.</Text>
        </>
      }
    >
      <View style={styles.recipeHero}>
        <LinearGradient
          colors={[colors.warmSoft, colors.earth100, colors.earth200]}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.recipeEmoji}>{recipe.emoji}</Text>
        <IconButton icon={ArrowLeft} onPress={() => nav("matches")} style={styles.topLeft} />
        <Pressable
          style={({ pressed }) => [
            styles.suggested,
            styles.inline,
            pressed ? styles.pressedBtn : null,
          ]}
          onPress={() => onToggleSave(recipe.id)}
          hitSlop={8}
        >
          <Bookmark
            size={13}
            color={saved ? colors.leaf : colors.earth800}
            fill={saved ? colors.leaf : "transparent"}
          />
          <Text style={[styles.suggestedText, saved ? styles.leafText : null]}>
            {saved ? "Saved" : "Save"}
          </Text>
        </Pressable>
        <View style={styles.recipeHeroFooter}>
          <Text style={styles.recipeHeroTitle}>{recipe.title}</Text>
          <Text style={styles.recipeHeroMeta}>
            {recipe.time}  ·  {recipe.level}  ·  {recipe.skill}
          </Text>
        </View>
      </View>

      <View style={styles.recipeBody}>
        <Text style={[styles.bodyText, styles.mt4]}>{recipe.blurb}</Text>

        <View style={styles.rowBetweenEnd}>
          <SectionTitle title={`You have · ${have.length}`} style={styles.mt28} />
        </View>
        <View style={styles.kitList}>
          {have.map((item) => (
            <KitRow key={item.name} name={item.name} amount={item.amount} isMissing={false} />
          ))}
          {have.length === 0 && <Text style={styles.tiny}>Nothing yet — see below.</Text>}
        </View>

        {need.length > 0 && (
          <>
            <SectionTitle title={`You'll need · ${need.length}`} style={styles.mt24} />
            <View style={styles.kitList}>
              {need.map((item) => (
                <KitRow key={item.name} name={item.name} amount={item.amount} isMissing />
              ))}
            </View>
            <Pressable style={[styles.missingButton, styles.mt12]} onPress={() => nav("savings")}>
              <Tag size={14} color={colors.warm} />
              <Text style={styles.missingButtonText}>Find these cheap nearby</Text>
              <ArrowRight size={14} color={colors.warm} />
            </Pressable>
          </>
        )}

        <SectionTitle title="Tools you'll grab" style={styles.mt28} />
        <View style={styles.inline}>
          <Utensils size={16} color={colors.earth600} />
          <Text style={styles.bodyDark}>{recipe.tools.join(" · ")}</Text>
        </View>

        <Card tone="warm" style={styles.mt24}>
          <Text style={styles.warmEyebrow}>From Remy</Text>
          <Text style={styles.coachQuote}>"{recipe.remyNote}"</Text>
        </Card>
      </View>
    </Shell>
  );
}

type TrackStatus = {
  present: boolean;
  steady: boolean;
  status: string;
  grip: GripResult | null;
  action: string | null;
  cameraMoving: boolean;
  gesture: GestureCommandEvent | null;
};

function fmtSecs(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Short ding when a cook timer finishes (web only; fails silently elsewhere). */
function ding() {
  try {
    const Ctx =
      (globalThis as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
      (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.7);
    osc.start();
    osc.stop(ctx.currentTime + 0.7);
  } catch {
    // no audio available — visual cue still shows
  }
}

type CookTimer = { label: string; total: number; left: number; done: boolean };

function LiveScreen({
  nav,
  recipe,
  initialStep = 0,
  onProgress,
  onFinish,
}: {
  nav: Nav;
  recipe: Recipe;
  initialStep?: number;
  onProgress: (step: number) => void;
  onFinish: (done: number, total: number, secs: number) => void;
}) {
  const [step, setStep] = useState(initialStep);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [quietMode, setQuietMode] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [gestureNotice, setGestureNotice] = useState<string | null>(null);
  const [track, setTrack] = useState<TrackStatus>({
    present: false,
    steady: false,
    status: "idle",
    grip: null,
    action: null,
    cameraMoving: false,
    gesture: null,
  });

  const steps = recipe.steps;
  const total = steps.length;
  const current = steps[step]!;
  const isLast = step >= total - 1;

  // CV coaching engine: feed tracking events once a second; surface phrases.
  const coachRef = useRef(createCoach());
  const speechRef = useRef(createSpeechCoach());
  const soundOnRef = useRef(soundOn);
  const quietModeRef = useRef(quietMode);
  const trackRef = useRef(track);
  trackRef.current = track;
  soundOnRef.current = soundOn;
  quietModeRef.current = quietMode;
  const stepRef = useRef({ idx: step, entered: true });
  const [coachMsg, setCoachMsg] = useState<{ text: string; severity: string; at: number } | null>(
    null,
  );
  useEffect(() => {
    stepRef.current = { idx: step, entered: true };
    setShowWhy(false);
  }, [step]);

  const stepInstruction = `Step ${step + 1}. ${current.title}. ${current.body}`;

  useEffect(() => {
    speechRef.current.setInstruction(stepInstruction);
    speechRef.current.speak(stepInstruction, {
      soundOn,
      quietMode: false,
      severity: "step",
      urgent: true,
    });
  }, [stepInstruction, soundOn]);

  useEffect(() => () => speechRef.current.stop(), []);

  // Step timer ("let it boil") — inferred from the step text.
  const [timer, setTimer] = useState<CookTimer | null>(null);
  const suggestedMin = stepMinutes(current);
  const timerIsForThisStep = timer?.label === current.title;

  const startTimer = () => {
    if (!suggestedMin) return;
    setTimer({ label: current.title, total: suggestedMin * 60, left: suggestedMin * 60, done: false });
  };

  // One shared tick: session clock + cook timer + coaching engine (pause-aware).
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setElapsed((e) => {
        const now = e + 1;
        const tr = trackRef.current;
        const entered = stepRef.current.entered;
        stepRef.current.entered = false;
        const phrase = coachRef.current.update({
          t: now,
          present: tr.present,
          steady: tr.steady,
          grip: tr.grip,
          stepType: recipe.steps[stepRef.current.idx]?.stepType ?? "prep",
          stepEntered: entered,
          action: tr.action as ActionLabel | null,
          cameraMoving: tr.cameraMoving,
        });
        if (phrase) {
          const text = `${phrase.what} ${phrase.how} ${phrase.why}`;
          const speechSeverity: SpeechSeverity =
            phrase.severity === "safety"
              ? "safety"
              : phrase.trigger === "camera-unsteady"
                ? "warning"
                : phrase.severity === "praise"
                  ? "praise"
                  : "tip";
          setCoachMsg({
            text,
            severity: phrase.severity,
            at: now,
          });
          speechRef.current.speak(text, {
            soundOn: soundOnRef.current,
            quietMode: quietModeRef.current,
            severity: speechSeverity,
            urgent: speechSeverity === "safety" || speechSeverity === "warning",
          });
        }
        return now;
      });
      setTimer((prev) =>
        prev && !prev.done
          ? prev.left <= 1
            ? { ...prev, left: 0, done: true }
            : { ...prev, left: prev.left - 1 }
          : prev,
      );
    }, 1000);
    return () => clearInterval(t);
  }, [paused, recipe]);

  // Ding once when the cook timer completes.
  useEffect(() => {
    if (timer?.done) ding();
  }, [timer?.done]);

  // Remember where the cook is, so Home can offer "Resume".
  useEffect(() => {
    onProgress(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const trackingWarning =
    track.status === "error"
      ? { key: "camera-error", text: "Camera is off. You can still follow the step card." }
      : track.status === "tracking" && track.cameraMoving
        ? { key: "camera-moving", text: "The camera is moving too much. Prop the phone up or hold it steady." }
        : track.status === "tracking" && !track.present && elapsed > 2
          ? { key: "hands-lost", text: "I lost your hands. Bring them back into frame." }
          : track.status === "tracking" && track.present && !track.steady && elapsed > 3
            ? { key: "hands-unsteady", text: "Hold steady for a second so I can lock on." }
            : null;

  useEffect(() => {
    if (!trackingWarning || paused) return;
    speechRef.current.speak(trackingWarning.text, {
      soundOn,
      quietMode,
      severity: "warning",
      urgent: true,
    });
  }, [trackingWarning?.key, paused, soundOn, quietMode]);

  const goBack = () => (step > 0 ? setStep(step - 1) : nav("recipe"));
  const goNext = () =>
    isLast ? onFinish(total, total, elapsed) : setStep(step + 1);

  const showGestureNotice = (text: string) => setGestureNotice(text);

  const repeatInstruction = (notice = "Repeating step") => {
    showGestureNotice(notice);
    speechRef.current.repeat({ soundOn, quietMode, urgent: true });
  };

  const lastGestureIdRef = useRef(0);
  useEffect(() => {
    const event = track.gesture;
    if (!event || event.id === lastGestureIdRef.current) return;
    lastGestureIdRef.current = event.id;

    if (event.command === "toggle_pause") {
      setPaused((prev) => {
        const next = !prev;
        showGestureNotice(next ? "Gesture: Paused" : "Gesture: Resumed");
        return next;
      });
      return;
    }

    if (event.command === "next_step") {
      showGestureNotice(isLast ? "Gesture: Finish" : "Gesture: Next step");
      if (isLast) onFinish(total, total, elapsed);
      else setStep((prev) => Math.min(prev + 1, total - 1));
      return;
    }

    repeatInstruction("Gesture: Repeating step");
  }, [track.gesture, isLast, total, elapsed, onFinish, soundOn, quietMode]);

  useEffect(() => {
    if (!gestureNotice) return;
    const t = setTimeout(() => setGestureNotice(null), 1600);
    return () => clearTimeout(t);
  }, [gestureNotice]);

  const coaching = coachMsg && elapsed - coachMsg.at < 12 ? coachMsg : null;
  const coachText = coaching
    ? coaching.text
    : timer?.done
      ? `⏰ Time's up on "${timer.label}" — take a look before moving on.`
      : timer && !timer.done
        ? `${fmtSecs(timer.left)} left on "${timer.label}" — I'll keep an eye on the clock with you.`
        : track.status === "error"
          ? "Camera's off — no problem, you can still follow the steps below."
          : track.status !== "tracking"
            ? "Getting the camera ready…"
            : !track.present
              ? "Bring your hands into frame so I can follow along."
              : !track.steady
                ? "Hold steady for a second so I can lock on to your hands."
                : suggestedMin
                  ? `Locked on — "${current.title}" is about a ${suggestedMin}-minute wait. Set a timer below?`
                  : `Locked on — I'm watching while you ${current.title.toLowerCase()}.`;

  return (
    <SafeAreaView style={styles.liveSafe}>
      <View style={styles.liveViewport}>
        <HandTrackingView onStatus={setTrack} />

        <View style={styles.liveTop}>
          <IconButton icon={ChevronLeft} dark onPress={() => nav("recipe")} />
          <View style={styles.liveCenter}>
            <View style={styles.livePill}>
              <Text style={styles.livePillText}>
                Step {step + 1} of {total} · {current.title}
              </Text>
            </View>
            <View style={styles.dots}>
              {steps.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i < step ? styles.dotWarm : i === step ? styles.dotActive : styles.dotMuted,
                  ]}
                />
              ))}
            </View>
            <Text style={styles.liveTimer}>
              {fmtSecs(elapsed)}
              {paused ? " · paused" : ""}
            </Text>
          </View>
          <IconButton icon={X} dark onPress={() => onFinish(step, total, elapsed)} />
        </View>

        <View style={styles.sideControls}>
          <Pressable
            accessibilityLabel="Quiet mode"
            style={[styles.liveCircle, quietMode ? styles.liveCircleActive : null]}
            onPress={() => setQuietMode((v) => !v)}
          >
            <Bell size={16} color={colors.white} />
          </Pressable>
          <Pressable
            accessibilityLabel="Sound"
            style={[styles.liveCircle, !soundOn ? styles.liveCircleOff : null]}
            onPress={() => setSoundOn((v) => !v)}
          >
            <Volume2 size={16} color={soundOn ? colors.white : "rgba(255,255,255,0.45)"} />
          </Pressable>
          <Pressable
            accessibilityLabel={paused ? "Resume" : "Pause"}
            style={[styles.liveCircle, paused ? styles.liveCircleActive : null]}
            onPress={() => setPaused((v) => !v)}
          >
            <Pause size={16} color={colors.white} />
          </Pressable>
          <Pressable
            accessibilityLabel="Repeat step"
            style={styles.liveCircle}
            onPress={() => repeatInstruction()}
          >
            <RefreshCw size={16} color={colors.white} />
          </Pressable>
        </View>

        {gestureNotice && (
          <View style={styles.gestureToast}>
            <Check size={13} color={colors.leaf} />
            <Text style={styles.gestureToastText}>{gestureNotice}</Text>
          </View>
        )}

        <View style={styles.liveBottom}>
          <View style={styles.coachBubble}>
            <View style={styles.pulseWrap}>
              <View style={[styles.pulseDot, track.steady ? styles.pulseDotLocked : null]} />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.coachLabel}>Remy · live</Text>
              <Text style={styles.coachText}>{coachText}</Text>
            </View>
          </View>

          {timer && (
            <View style={[styles.timerBox, timer.done ? styles.timerBoxDone : null]}>
              <View style={styles.rowBetween}>
                <Text style={styles.timerText}>
                  {timer.done ? "⏰ Time's up!" : fmtSecs(timer.left)} · {timer.label}
                </Text>
                <Pressable onPress={() => setTimer(null)} hitSlop={8}>
                  <X size={15} color={colors.earth600} />
                </Pressable>
              </View>
              <Progress
                value={Math.round(((timer.total - timer.left) / timer.total) * 100)}
                color={timer.done ? colors.leaf : colors.warm}
                style={styles.mt8}
              />
            </View>
          )}

          <View style={styles.guidanceCard}>
            <Text style={styles.eyebrow}>Step {step + 1} of {total}</Text>
            <Text style={styles.guidanceTitle}>{current.title}</Text>
            <Text style={styles.cardBody}>{current.body}</Text>
            {current.doneness && (
              <View style={styles.donenessRow}>
                <Check size={13} color={colors.leaf} />
                <Text style={styles.donenessText}>Done when: {current.doneness}</Text>
              </View>
            )}
            {current.why && (
              <Pressable onPress={() => setShowWhy((v) => !v)} hitSlop={6}>
                <Text style={styles.whyToggle}>{showWhy ? "▾ Why this matters" : "▸ Why?"}</Text>
                {showWhy && <Text style={styles.whyText}>{current.why}</Text>}
              </Pressable>
            )}
            {suggestedMin && !timerIsForThisStep && (
              <Pressable
                style={({ pressed }) => [styles.timerBtn, pressed ? styles.pressedBtn : null]}
                onPress={startTimer}
              >
                <Timer size={15} color={colors.warm} />
                <Text style={styles.timerBtnText}>Set timer · {suggestedMin} min</Text>
              </Pressable>
            )}
            <View style={styles.buttonRow}>
              <Pressable style={styles.backButton} onPress={goBack}>
                <Text style={styles.backButtonText}>{step > 0 ? "Back" : "Recipe"}</Text>
              </Pressable>
              <Pressable style={styles.nextButton} onPress={goNext}>
                <Text style={styles.nextButtonText}>
                  {isLast ? "Finish · recap" : "I'm done · next"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function StarRating({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n)} hitSlop={6}>
          <Star
            size={28}
            color={n <= value ? colors.warm : colors.earth400}
            fill={n <= value ? colors.warm : "transparent"}
            strokeWidth={2}
          />
        </Pressable>
      ))}
    </View>
  );
}

function FeedbackScreen({
  nav,
  recipe,
  session,
}: {
  nav: Nav;
  recipe: Recipe;
  session: Session | null;
}) {
  const [recipeStars, setRecipeStars] = useState(0);
  const [remyStars, setRemyStars] = useState(0);
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [submitState, setSubmitState] = useState<"idle" | "sending" | "error">("idle");

  const submitReview = () => {
    if (recipeStars + remyStars === 0 || submitState === "sending") return;
    setSubmitState("sending");
    // Only call it a success once the backend actually stored it.
    postReview({ recipeId: recipe.id, recipeStars, remyStars, tags: [...tags] })
      .then(() => {
        setSubmitState("idle");
        setSubmitted(true);
      })
      .catch(() => setSubmitState("error"));
  };

  const tagOptions = ["Clear steps", "Well timed", "Too fast", "Want more detail", "Loved it"];
  const toggleTag = (t: string) => {
    const next = new Set(tags);
    next.has(t) ? next.delete(t) : next.add(t);
    setTags(next);
  };

  return (
    <Shell nav={nav} active="home">
      <View style={styles.center}>
        <View style={styles.leafRound}>
          <Check size={24} color={colors.leaf} strokeWidth={2.5} />
        </View>
        <Text style={styles.serifSubTitle}>
          {!session || session.done >= session.total
            ? "Beautifully done."
            : "Good stopping point."}
        </Text>
        <Text style={[styles.bodyText, styles.centerText]}>
          {!session || session.done >= session.total
            ? `Your ${recipe.title.toLowerCase()} is plated. Calm hands throughout — that's the win.`
            : `You worked through ${session.done} of ${session.total} steps. The recipe will be waiting when you're ready.`}
        </Text>
      </View>

      <View style={[styles.metaRowWhite, styles.mt24]}>
        <Stat
          label="Steps"
          value={
            session ? `${session.done}/${session.total}` : `${recipe.steps.length} steps`
          }
        />
        <View style={styles.metaDivider} />
        <Stat
          label="Time"
          value={
            session
              ? `${Math.floor(session.secs / 60)}m ${session.secs % 60}s`
              : recipe.time
          }
        />
        <View style={styles.metaDivider} />
        <Stat label="Skill +" value={recipe.skill} />
      </View>

      <View style={styles.twoCol}>
        <View style={[styles.feedbackCard, styles.leafCard]}>
          <Text style={styles.leafEyebrow}>Win</Text>
          <Text style={styles.cardTitle}>
            {!session || session.done >= session.total
              ? `You cooked ${recipe.title.toLowerCase()} start to finish.`
              : "You stepped up to the stove — that's the hard part."}
          </Text>
        </View>
        <View style={[styles.feedbackCard, styles.warmCard]}>
          <Text style={styles.warmEyebrow}>To try</Text>
          <Text style={styles.cardTitle}>{recipe.remyNote}</Text>
        </View>
      </View>

      <SectionTitle title="Tiny next steps" style={styles.mt20} />
      <ActionRow
        icon={Sparkles}
        title="Cook something new"
        meta="Another recipe matched to your kitchen"
        onPress={() => nav("setup")}
      />
      <ActionRow
        icon={TrendingUp}
        title={`Grow ${recipe.skill} in your skill tree`}
        meta="Completed cooks move the bar"
        onPress={() => nav("profile")}
      />

      <View style={[styles.reviewCard, styles.mt28]}>
        {submitted ? (
          <View style={styles.center}>
            <View style={styles.leafRound}>
              <Sparkles size={22} color={colors.leaf} />
            </View>
            <Text style={styles.cardTitle}>Thanks — Remy's listening.</Text>
            <Text style={[styles.cardBody, styles.centerText]}>
              Your notes shape tomorrow's coaching.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.warmEyebrow}>Rate this cook</Text>
            <Text style={[styles.reviewQ, styles.mt8]}>How was the {recipe.title}?</Text>
            <StarRating value={recipeStars} onChange={setRecipeStars} />
            <Text style={[styles.reviewQ, styles.mt16]}>How was Remy's coaching?</Text>
            <StarRating value={remyStars} onChange={setRemyStars} />
            <View style={[styles.chipWrap, styles.mt16]}>
              {tagOptions.map((t) => {
                const on = tags.has(t);
                return (
                  <Pressable
                    key={t}
                    onPress={() => toggleTag(t)}
                    style={[styles.reviewTag, on ? styles.reviewTagOn : null]}
                  >
                    <Text style={[styles.reviewTagText, on ? styles.reviewTagTextOn : null]}>
                      {t}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              style={[
                styles.reviewSubmit,
                recipeStars === 0 && remyStars === 0 ? styles.reviewSubmitOff : null,
              ]}
              onPress={submitReview}
            >
              <Text style={styles.reviewSubmitText}>
                {submitState === "sending"
                  ? "Saving…"
                  : submitState === "error"
                    ? "Couldn't save — tap to retry"
                    : "Submit review"}
              </Text>
            </Pressable>
            {submitState === "error" && (
              <Text style={styles.reviewErr}>
                We couldn't reach Remy. Your rating isn't saved yet — try again.
              </Text>
            )}
          </>
        )}
      </View>

      <View style={styles.pushBottom}>
        <PrimaryButton label="Back to home" onPress={() => nav("home")} dark />
      </View>
    </Shell>
  );
}

function SavingsScreen({
  nav,
  missing,
  cooking,
}: {
  nav: Nav;
  missing: string[];
  /** Title of the recipe in progress, if any — enables "Continue cooking". */
  cooking: string | null;
}) {
  const openFlyers = () => {
    void Linking.openURL("https://flipp.com/").catch(() => {});
  };

  /** Official Google Maps search URL — opens the store in Maps, no API key needed. */
  const openMaps = (storeName: string) => {
    const q = encodeURIComponent(`${storeName} grocery store near me`);
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`).catch(() => {});
  };

  const stores = [
    {
      name: "Market St Grocer",
      dist: "2 blocks",
      deal: "Organic tomatoes · $1.99/lb",
      until: "Sun",
      hours: "8:00–21:00",
      open: true,
    },
    {
      name: "Greenfield Co-op",
      dist: "0.6 mi",
      deal: "Garlic 3-pack · $1.29",
      until: "Wed",
      hours: "9:00–20:00",
      open: true,
    },
    {
      name: "Sunrise Foods",
      dist: "1.1 mi",
      deal: "Olive oil 500ml · $5.49",
      until: "Fri",
      hours: "10:00–18:00",
      open: false,
    },
  ];

  const swaps = [
    {
      from: "Pine nuts",
      to: "Toasted sunflower seeds",
      note: "Same nutty crunch in pesto.",
      save: "$4.80",
    },
    {
      from: "Heavy cream",
      to: "Whole milk + butter",
      note: "Works for most weeknight sauces.",
      save: "$2.10",
    },
    {
      from: "Fresh basil",
      to: "Frozen basil cubes",
      note: "Keeps for months, same flavor.",
      save: "$1.40",
    },
  ];

  return (
    <Shell
      nav={nav}
      active="savings"
      footer={
        cooking ? (
          <>
            <PrimaryButton
              label={`Continue cooking · ${cooking}`}
              icon={Flame}
              warm
              onPress={() => nav("recipe")}
            />
            <Text style={styles.stickyHint}>Got what you need? Pick up where you left off.</Text>
          </>
        ) : undefined
      }
    >
      <Text style={styles.leafEyebrow}>Smart living</Text>
      <Text style={styles.serifSubTitle}>Cheap ingredients,{"\n"}close by.</Text>
      <Text style={[styles.bodyText, styles.mt8]}>
        Honest swaps and nearby deals from Remy — no upsell, no spam.
      </Text>

      {missing.length > 0 && (
        <View style={[styles.missingCard, styles.mt20]}>
          <Text style={styles.warmEyebrow}>Your shopping list</Text>
          <Text style={[styles.cardBody, styles.mt4]}>
            From your recipe, you still need:
          </Text>
          <View style={[styles.chipWrap, styles.mt8]}>
            {missing.map((m) => (
              <View key={m} style={styles.shopChip}>
                <Text style={styles.shopChipText}>{m}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <SectionTitle title="Deals near you" style={styles.mt28} />
      <Text style={[styles.tiny, styles.mb10]}>
        Sample deals for now — tap a store to open it in Google Maps.
      </Text>
      {stores.map((store) => (
        <Pressable
          key={store.name}
          style={({ pressed }) => [styles.flyerCard, pressed ? styles.pressedBtn : null]}
          onPress={() => openMaps(store.name)}
        >
          <View style={styles.flyerIcon}>
            <Store size={18} color={colors.warm} />
          </View>
          <View style={styles.flex1}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>{store.name}</Text>
              <View style={styles.inline}>
                <MapPin size={11} color={colors.earth600} />
                <Text style={styles.flyerDist}>{store.dist}</Text>
              </View>
            </View>
            <Text style={styles.flyerDeal}>{store.deal}</Text>
            <View style={styles.rowBetween}>
              <Text style={styles.tiny}>
                <Text style={store.open ? styles.openNow : styles.closedNow}>
                  {store.open ? "Open" : "Closed"}
                </Text>{" "}
                · {store.hours} · deal until {store.until}
              </Text>
              <ExternalLink size={13} color={colors.earth400} />
            </View>
          </View>
        </Pressable>
      ))}

      <Pressable style={[styles.flyerButton, styles.mt12]} onPress={openFlyers}>
        <ExternalLink size={16} color={colors.canvas} />
        <Text style={styles.flyerButtonText}>Browse all flyers on Flipp</Text>
      </Pressable>

      <SectionTitle title="Try these swaps" style={styles.mt28} />
      {swaps.map((swap) => (
        <View key={swap.from} style={styles.swapCard}>
          <View style={styles.flex1}>
            <Text style={styles.swapLine}>
              <Text style={styles.strike}>{swap.from}</Text>{" "}
              <Text style={styles.strong}>{"->"} {swap.to}</Text>
            </Text>
            <Text style={styles.cardBody}>{swap.note}</Text>
          </View>
          <View style={styles.savePill}>
            <Text style={styles.saveText}>-{swap.save}</Text>
          </View>
        </View>
      ))}

      <SectionTitle title="On sale near you" style={styles.mt28} />
      <View style={styles.saleCard}>
        <View style={styles.inline}>
          <MapPin size={12} color={colors.warm} />
          <Text style={styles.warmEyebrow}>Market St - 2 blocks</Text>
        </View>
        <Text style={styles.saleTitle}>Organic tomatoes, $1.99/lb until Sunday.</Text>
        <Text style={styles.cardBody}>
          Perfect for the marinara you're mid-way through.
        </Text>
      </View>

      <SectionTitle title="Practical tips" style={styles.mt28} />
      {[
        {
          title: "Salt the pasta water, save the rest",
          body: "Reserved starchy water replaces extra cream or butter in most sauces.",
        },
        {
          title: "Day-old bread -> breadcrumbs",
          body: "Toast, blitz, freeze. Boxed crumbs cost 5x more per cup.",
        },
      ].map((tip) => (
        <View key={tip.title} style={styles.tipCard}>
          <View style={styles.smallEarthBox}>
            <Sparkles size={16} color={colors.earth800} />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.cardTitle}>{tip.title}</Text>
            <Text style={styles.cardBody}>{tip.body}</Text>
          </View>
        </View>
      ))}
    </Shell>
  );
}

function ProfileScreen({
  nav,
  savedRecipes,
  onOpenSaved,
  sessions,
  streak,
  skillTree,
  pref,
  onCyclePref,
  skill,
  onCycleSkill,
  onReset,
}: {
  nav: Nav;
  savedRecipes: Recipe[];
  onOpenSaved: (r: Recipe) => void;
  sessions: number;
  streak: number;
  skillTree: { name: string; level: number; sessions: number }[];
  pref: string;
  onCyclePref: () => void;
  skill: SkillLevel;
  onCycleSkill: () => void;
  onReset: () => void;
}) {

  return (
    <Shell nav={nav} active="profile">
      <View style={styles.rowBetween}>
        <View style={styles.inlineWide}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>A</Text>
          </View>
          <View>
            <Text style={styles.eyebrow}>Home cook</Text>
            <Text style={styles.profileName}>Alex Rivera</Text>
          </View>
        </View>
        <View style={styles.circleWhite}>
          <Bell size={16} color={colors.earth800} />
        </View>
      </View>

      <View style={[styles.metaRow, styles.mt24]}>
        <Stat label="Sessions" value={String(sessions)} />
        <View style={styles.metaDivider} />
        <Stat label="Recipes" value={String(savedRecipes.length)} />
        <View style={styles.metaDivider} />
        <Stat label="Streak" value={`${streak}d`} />
      </View>

      <View style={[styles.rowBetweenEnd, styles.mt28]}>
        <SectionTitle title="Your skill tree" />
        <View style={styles.inline}>
          <Sparkles size={12} color={colors.leaf} />
          <Text style={styles.leafSmall}>
            {skillTree.length > 0 ? "Growing" : "Plant the first seed"}
          </Text>
        </View>
      </View>
      <View style={styles.whitePanel}>
        {skillTree.length === 0 ? (
          <Text style={styles.cardBody}>
            Finish a cook in live mode and the skill you practiced shows up here. Three
            completed cooks of a skill = mastered.
          </Text>
        ) : (
          skillTree.map((s) => (
            <View key={s.name} style={styles.skillRow}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>{s.name}</Text>
                <Text style={styles.tiny}>
                  {s.level}% · {s.sessions} cook{s.sessions === 1 ? "" : "s"}
                </Text>
              </View>
              <Progress value={s.level} color={colors.warm} style={styles.mt8} />
            </View>
          ))
        )}
      </View>

      <SectionTitle title={`Saved recipes · ${savedRecipes.length}`} style={styles.mt28} />
      {savedRecipes.length === 0 ? (
        <View style={styles.savedRow}>
          <View style={styles.savedEmoji}>
            <Text style={styles.emojiMed}>🔖</Text>
          </View>
          <View style={styles.flex1}>
            <Text style={styles.cardTitle}>Nothing saved yet</Text>
            <Text style={styles.tiny}>Tap Save on any recipe to keep it here.</Text>
          </View>
        </View>
      ) : (
        savedRecipes.map((r) => (
          <Pressable
            key={r.id}
            style={({ pressed }) => [styles.savedRow, pressed ? styles.pressedBtn : null]}
            onPress={() => onOpenSaved(r)}
          >
            <View style={styles.savedEmoji}>
              <Text style={styles.emojiMed}>{r.emoji}</Text>
            </View>
            <View style={styles.flex1}>
              <Text style={styles.cardTitle}>{r.title}</Text>
              <Text style={styles.tiny}>
                {r.time} · {r.level}
              </Text>
            </View>
            <Bookmark size={16} color={colors.leaf} fill={colors.leaf} />
          </Pressable>
        ))
      )}

      <SectionTitle title="Preferences" style={styles.mt28} />
      <View style={styles.prefBox}>
        <Pressable onPress={onCyclePref}>
          <Pref label="Dietary preferences" value={pref} />
        </Pressable>
        <Pressable onPress={onCycleSkill}>
          <Pref label="Kitchen confidence" value={skill} />
        </Pressable>
        <Pref label="Coach voice" value="Calm & warm" />
        <Pref label="Camera & mic" value="Always ask" />
      </View>

      <Pressable style={styles.settingsRow} onPress={() => nav("onboarding")}>
        <View style={styles.inlineWide}>
          <Settings size={16} color={colors.earth600} />
          <Text style={styles.cardTitle}>Replay the intro</Text>
        </View>
        <ChevronRight size={16} color={colors.earth600} />
      </Pressable>

      <Pressable style={styles.settingsRow} onPress={onReset}>
        <View style={styles.inlineWide}>
          <RefreshCw size={16} color={colors.warm} />
          <Text style={[styles.cardTitle, styles.warmText]}>Clear what Remy remembers</Text>
        </View>
        <ChevronRight size={16} color={colors.earth600} />
      </Pressable>

      <Text style={styles.smallCenter}>
        Remy learns gently. Clearing wipes saved recipes, sessions and your basket.
      </Text>
    </Shell>
  );
}

function KitchenCamera({
  open,
  onClose,
  shots,
  setShots,
}: {
  open: boolean;
  onClose: () => void;
  shots: CapturedShot[];
  setShots: (shots: CapturedShot[]) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const addAssets = (assets: ImagePicker.ImagePickerAsset[]) => {
    const next = assets.map((asset, index) => ({
      id: `${Date.now()}-${asset.assetId ?? index}`,
      uri: asset.uri,
      label: labelCycle[(shots.length + index) % labelCycle.length],
    }));
    setShots([...shots, ...next]);
  };

  const takePhoto = async () => {
    setError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError("Camera is blocked");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.82,
      allowsEditing: false,
    });
    if (!result.canceled) addAssets(result.assets);
  };

  const uploadPhotos = async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo library is blocked");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.82,
    });
    if (!result.canceled) addAssets(result.assets);
  };

  return (
    <Modal visible={open} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.cameraSafe}>
        <View style={styles.cameraTop}>
          <IconButton icon={X} dark onPress={onClose} />
          <View style={styles.livePill}>
            <Text style={styles.livePillText}>Scan your kitchen</Text>
          </View>
          <View style={styles.iconButtonSpacer} />
        </View>

        <View style={styles.cameraViewport}>
          <FauxCamera />
          <View style={styles.permissionPanel}>
            <View style={styles.cameraIconLarge}>
              {error ? (
                <ShieldAlert size={28} color={colors.warm} />
              ) : (
                <Camera size={28} color={colors.warm} />
              )}
            </View>
            <Text style={styles.cameraTitle}>
              {error ? error : "Show Remy your kitchen"}
            </Text>
            <Text style={styles.cameraBody}>
              Snap a few photos - the fridge, the pantry, what's on the counter.
              Remy will piece together what you can cook.
            </Text>
            <View style={styles.cameraBullets}>
              <Bullet>Photos never leave your device until you tap Done.</Bullet>
              <Bullet>You can retake or remove any shot.</Bullet>
              <Bullet>Remy skips anything it isn't sure about.</Bullet>
            </View>
          </View>
        </View>

        {shots.length > 0 && (
          <View style={styles.cameraShots}>
            <View style={styles.rowBetween}>
              <Text style={styles.cameraShotTitle}>
                {shots.length} shot{shots.length === 1 ? "" : "s"} captured
              </Text>
              <Pressable onPress={() => setShots([])}>
                <Text style={styles.cameraClear}>Clear</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {shots.map((shot) => (
                <View key={shot.id} style={styles.cameraThumbWrap}>
                  <Image source={{ uri: shot.uri }} style={styles.cameraThumb} />
                  <Text style={styles.cameraThumbLabel}>{shot.label}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.cameraControls}>
          <IconButton icon={ImagePlus} dark onPress={uploadPhotos} />
          <Pressable style={styles.shutter} onPress={takePhoto}>
            <View style={styles.shutterInner}>
              <Camera size={24} color={colors.earth950} />
            </View>
          </Pressable>
          <Pressable
            style={[styles.doneButton, shots.length === 0 ? styles.doneDisabled : null]}
            onPress={shots.length > 0 ? onClose : undefined}
          >
            <Text
              style={[
                styles.doneText,
                shots.length === 0 ? styles.doneTextDisabled : null,
              ]}
            >
              Done
            </Text>
            <CheckCircle2
              size={16}
              color={shots.length > 0 ? colors.white : "rgba(255,255,255,0.4)"}
            />
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function BottomNav({ nav, active }: { nav: Nav; active: Screen }) {
  const tabs = [
    { screen: "home" as const, label: "Home", icon: Home },
    { screen: "setup" as const, label: "Cook", icon: ChefHat },
    { screen: "savings" as const, label: "Savings", icon: Tag },
    { screen: "profile" as const, label: "Profile", icon: User },
  ];

  return (
    <View style={styles.bottomNav}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive =
          active === tab.screen ||
          (tab.screen === "setup" && (active === "recipe" || active === "live"));
        return (
          <Pressable
            key={tab.screen}
            style={styles.navItem}
            onPress={() => nav(tab.screen)}
          >
            <View style={[styles.navIcon, isActive ? styles.navIconActive : null]}>
              <Icon
                size={18}
                color={isActive ? colors.canvas : colors.earth600}
                strokeWidth={isActive ? 2.4 : 2}
              />
            </View>
            <Text style={[styles.navText, isActive ? styles.navTextActive : null]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PrimaryButton({
  label,
  icon: Icon,
  onPress,
  dark,
  warm,
}: {
  label: string;
  icon?: IconType;
  onPress: () => void;
  dark?: boolean;
  warm?: boolean;
}) {
  const gradient: [string, string] = warm
    ? ["#f59e0b", "#d97706"]
    : dark
      ? ["#1e293b", "#0f172a"]
      : ["#10b981", "#047857"];
  const glow = warm ? "#d97706" : dark ? "#0f172a" : "#059669";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.primaryButton,
        // solid fallback + glow — button stays visible even if the gradient fails
        { shadowColor: glow, backgroundColor: glow },
        pressed ? styles.primaryPressed : null,
      ]}
      onPress={onPress}
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryGradient}
      >
        {Icon && <Icon size={17} color={colors.white} />}
        <Text style={styles.primaryText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

function IconButton({
  icon: Icon,
  onPress,
  dark,
  style,
}: {
  icon: IconType;
  onPress?: () => void;
  dark?: boolean;
  style?: object;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        dark ? styles.iconButtonDark : styles.iconButtonLight,
        style,
        pressed ? styles.pressedBtn : null,
      ]}
      hitSlop={8}
      onPress={onPress}
    >
      <Icon size={16} color={dark ? colors.white : colors.earth950} />
    </Pressable>
  );
}

function SectionTitle({ title, style }: { title: string; style?: object }) {
  return <Text style={[styles.sectionTitle, style]}>{title}</Text>;
}

function Pill({
  label,
  icon: Icon,
  tone,
}: {
  label: string;
  icon?: IconType;
  tone: "leaf" | "warm";
}) {
  const color = tone === "leaf" ? colors.leaf : colors.warm;
  return (
    <View style={[styles.pill, { backgroundColor: tone === "leaf" ? colors.leafSoft : colors.warmSoft }]}>
      {Icon && <Icon size={12} color={color} />}
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

function Meta({ icon: Icon, label, value }: { icon: IconType; label: string; value: string }) {
  return (
    <View style={styles.metaCell}>
      <Icon size={16} color={colors.earth600} />
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaCell}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function Notice({ label, color }: { label: string; color: string }) {
  return (
    <View style={styles.noticeRow}>
      <View style={[styles.noticeDot, { backgroundColor: color }]} />
      <Text style={styles.bodyDark}>{label}</Text>
    </View>
  );
}

function ActionRow({
  icon: Icon,
  title,
  meta,
  onPress,
}: {
  icon: IconType;
  title: string;
  meta: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.actionRow} onPress={onPress}>
      <View style={styles.smallEarthBox}>
        <Icon size={16} color={colors.earth800} />
      </View>
      <View style={styles.flex1}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.tiny}>{meta}</Text>
      </View>
      <ArrowRight size={16} color={colors.earth600} />
    </Pressable>
  );
}

function Pref({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.prefRow}>
      <Text style={styles.cardTitle}>{label}</Text>
      <View style={styles.inline}>
        <Text style={styles.tiny}>{value}</Text>
        <ChevronRight size={14} color={colors.earth600} />
      </View>
    </View>
  );
}

function Progress({
  value,
  color,
  style,
}: {
  value: number;
  color: string;
  style?: object;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: value,
      duration: 750,
      delay: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [anim, value]);
  const width = anim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
    extrapolate: "clamp",
  });
  return (
    <View style={[styles.progressTrack, style]}>
      <Animated.View style={[styles.progressFill, { width, backgroundColor: color }]} />
    </View>
  );
}

function FauxCamera() {
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={["#5a4838", "#241a12", "#0a0604"]}
        start={{ x: 0.15, y: 0.15 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Text style={styles.panEmoji}>🍳</Text>
    </View>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <Sparkles size={12} color={colors.warm} />
      <Text style={styles.cameraBulletText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.canvas },
  safe: { flex: 1, backgroundColor: colors.canvas },
  shell: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 112,
    backgroundColor: colors.canvas,
  },
  shellBleed: { paddingHorizontal: 0, paddingTop: 0 },
  shellHideNav: { paddingBottom: 24 },
  onboarding: {
    flex: 1,
    minHeight: "100%",
    paddingHorizontal: 24,
    paddingTop: 44,
    paddingBottom: 40,
    backgroundColor: colors.canvas,
  },
  flex1: { flex: 1 },
  pushBottom: { marginTop: "auto", paddingTop: 32 },
  mt8: { marginTop: 8 },
  mt12: { marginTop: 12 },
  mt16: { marginTop: 16 },
  mt20: { marginTop: 20 },
  mt24: { marginTop: 24 },
  mt28: { marginTop: 28 },
  mt32: { marginTop: 32 },
  serifHero: {
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 44,
    lineHeight: 45,
    color: colors.earth950,
  },
  serifTitle: {
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 40,
    lineHeight: 42,
    color: colors.earth950,
  },
  serifSubTitle: {
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 32,
    lineHeight: 36,
    color: colors.earth950,
  },
  bodyText: {
    maxWidth: 320,
    fontFamily: "DMSans_400Regular",
    fontSize: 15,
    lineHeight: 23,
    color: colors.earth600,
  },
  bodyDark: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: colors.earth800,
  },
  cardBody: {
    marginTop: 4,
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: colors.earth600,
  },
  eyebrow: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 12,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.earth600,
  },
  warmEyebrow: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.warm,
  },
  leafEyebrow: {
    fontFamily: "DMSans_700Bold",
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: colors.leaf,
  },
  stepList: { marginTop: 40, gap: 16 },
  infoCardRow: {
    flexDirection: "row",
    gap: 16,
    padding: 20,
    borderRadius: 24,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  warmIconBox: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: colors.warmSoft,
  },
  warmSolidBox: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: colors.warm,
    borderWidth: 4,
    borderColor: "rgba(217,119,6,0.2)",
  },
  cardTitle: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 15,
    lineHeight: 20,
    color: colors.earth950,
  },
  smallCenter: {
    marginTop: 12,
    textAlign: "center",
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: colors.earth600,
  },
  primaryButton: {
    borderRadius: 20,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  primaryGradient: {
    minHeight: 54,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
  },
  primaryPressed: { transform: [{ scale: 0.98 }], shadowOpacity: 0.18 },
  primaryText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 15,
    color: colors.canvas,
  },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  inlineWide: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowTop: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowBetweenEnd: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  softPanel: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: "rgba(241,245,249,0.7)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  pill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillText: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  largeMetric: {
    marginTop: 6,
    fontFamily: "DMSans_500Medium",
    fontSize: 24,
    color: colors.earth950,
  },
  rightSmall: {
    textAlign: "right",
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: colors.earth600,
  },
  strong: { fontFamily: "DMSans_600SemiBold", color: colors.earth950 },
  progressTrack: {
    height: 6,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: colors.earth200,
  },
  progressFill: { height: "100%", borderRadius: 999 },
  sectionTitle: {
    marginBottom: 12,
    fontFamily: "DMSans_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.earth600,
  },
  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  foodTile: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.warmSoft,
  },
  emojiLarge: { fontSize: 28 },
  emojiMed: { fontSize: 24 },
  roundWarm: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: colors.warm,
  },
  tiny: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: colors.earth600,
  },
  twoCol: { flexDirection: "row", gap: 12, marginTop: 12 },
  tileCard: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  leafCard: {
    backgroundColor: colors.leafSoft,
    borderColor: "rgba(5,150,105,0.15)",
  },
  warmCard: {
    backgroundColor: colors.warmSoft,
    borderColor: "rgba(217,119,6,0.15)",
  },
  smallFoodTile: {
    width: 40,
    height: 40,
    marginBottom: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.earth100,
  },
  smallWhiteTile: {
    width: 40,
    height: 40,
    marginBottom: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  tileTitle: {
    marginBottom: 4,
    fontFamily: "DMSans_500Medium",
    fontSize: 14,
    lineHeight: 18,
    color: colors.earth950,
  },
  scanCard: {
    marginTop: 24,
    padding: 20,
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: colors.earth950,
    shadowColor: "#064e3b",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  scanGlowBox: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "rgba(5,150,105,0.45)",
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.5)",
  },
  scanActions: { marginTop: 16, flexDirection: "row", gap: 10 },
  scanPrimaryBtn: {
    flex: 1,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    backgroundColor: colors.white,
  },
  scanPrimaryBtnText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 14,
    color: colors.earth950,
  },
  scanGhostBtn: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  scanGhostBtnText: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 14,
    color: colors.white,
  },
  scanProgressWrap: { marginTop: 16, gap: 10 },
  scanScanningText: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
  },
  scanBarTrack: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  scanBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#34d399",
  },
  spottedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(5,150,105,0.3)",
  },
  spottedChipText: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 12,
    color: colors.earth950,
  },
  confirmBtn: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    backgroundColor: colors.leaf,
  },
  confirmBtnText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 13,
    color: colors.white,
  },
  dismissBtn: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(5,150,105,0.3)",
  },
  dismissBtnText: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 13,
    color: colors.earth800,
  },
  featuredBlurb: {
    marginTop: 4,
    marginBottom: 10,
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    lineHeight: 17,
    color: "rgba(255,255,255,0.85)",
  },
  featuredBadgeText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 12,
    color: "#047857",
  },
  scanEyebrow: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "rgba(250,234,219,0.9)",
  },
  scanTitle: {
    marginTop: 4,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 22,
    color: colors.canvas,
  },
  scanBody: {
    marginTop: 4,
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(247,250,249,0.7)",
  },
  shotSummary: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 8,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  shotStack: { flexDirection: "row" },
  shotThumb: {
    width: 36,
    height: 36,
    marginRight: -8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.earth950,
  },
  whiteStrong: { fontFamily: "DMSans_600SemiBold", color: colors.canvas },
  dividerRow: { marginVertical: 24, flexDirection: "row", alignItems: "center", gap: 12 },
  divider: { flex: 1, height: 1, backgroundColor: colors.earth200 },
  dividerText: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: colors.earth600,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  searchInput: {
    flex: 1,
    height: 34,
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: colors.earth950,
  },
  addButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.earth100,
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  darkChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.earth950,
  },
  darkChipText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 12,
    color: colors.canvas,
  },
  lightChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  lightChipText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 12,
    color: colors.earth950,
  },
  pantryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  pantryItem: {
    width: "30.7%",
    minHeight: 88,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  pantryActive: {
    backgroundColor: colors.warmSoft,
    borderColor: "rgba(217,119,6,0.3)",
  },
  pantryText: {
    textAlign: "center",
    fontFamily: "DMSans_500Medium",
    fontSize: 11,
    color: colors.earth950,
  },
  warmText: { color: colors.warm },
  recipeHero: {
    height: 300,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  recipeEmoji: { fontSize: 72, opacity: 0.82 },
  recipeHeroFooter: { position: "absolute", left: 20, right: 20, bottom: 40 },
  recipeHeroTitle: {
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 30,
    lineHeight: 32,
    color: colors.earth950,
  },
  recipeHeroMeta: {
    marginTop: 4,
    fontFamily: "DMSans_600SemiBold",
    fontSize: 12,
    letterSpacing: 0.4,
    color: colors.earth800,
  },
  topLeft: { position: "absolute", left: 16, top: 16 },
  suggested: {
    position: "absolute",
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(247,250,249,0.9)",
  },
  suggestedText: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.earth800,
  },
  recipeBody: {
    marginTop: -24,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 4,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.canvas,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 20,
    backgroundColor: "rgba(241,245,249,0.7)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  metaRowWhite: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  metaCell: { flex: 1, alignItems: "center" },
  metaDivider: { width: 1, alignSelf: "stretch", backgroundColor: colors.earth200 },
  metaLabel: {
    marginTop: 4,
    fontFamily: "DMSans_600SemiBold",
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.earth600,
  },
  metaValue: {
    marginTop: 2,
    fontFamily: "DMSans_600SemiBold",
    fontSize: 14,
    color: colors.earth950,
  },
  ingredientChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.earth200,
  },
  ingredientText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: colors.earth950,
  },
  coachNote: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: colors.warmSoft,
    borderWidth: 1,
    borderColor: "rgba(217,119,6,0.15)",
  },
  coachQuote: {
    marginTop: 4,
    fontFamily: "SpaceGrotesk_500Medium",
    fontSize: 19,
    lineHeight: 24,
    color: colors.earth950,
  },
  textButton: { paddingVertical: 14, alignItems: "center" },
  textButtonText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 14,
    color: colors.earth800,
  },
  liveSafe: { flex: 1, backgroundColor: colors.earth950 },
  liveViewport: { flex: 1, overflow: "hidden", backgroundColor: colors.earth950 },
  panEmoji: {
    position: "absolute",
    alignSelf: "center",
    top: "42%",
    fontSize: 64,
    opacity: 0.3,
  },
  liveTop: {
    position: "absolute",
    top: 24,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  liveCenter: { alignItems: "center", gap: 8 },
  livePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  livePillText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 11,
    color: colors.white,
  },
  dots: { flexDirection: "row", alignItems: "center", gap: 4 },
  dot: { height: 6, borderRadius: 999 },
  dotWarm: { width: 6, backgroundColor: colors.warm },
  dotActive: { width: 16, backgroundColor: colors.white },
  dotMuted: { width: 6, backgroundColor: "rgba(255,255,255,0.3)" },
  sideControls: {
    position: "absolute",
    right: 16,
    top: "42%",
    gap: 8,
  },
  liveCircleOff: { opacity: 0.55 },
  liveCircleActive: { backgroundColor: "rgba(217,119,6,0.55)", borderColor: "rgba(251,191,36,0.6)" },
  gestureToast: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 132,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: "rgba(5,150,105,0.25)",
  },
  gestureToastText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 12,
    color: colors.earth950,
  },
  liveTimer: {
    marginTop: 6,
    fontFamily: "DMSans_600SemiBold",
    fontSize: 11,
    color: "rgba(255,255,255,0.75)",
  },
  timerBox: {
    marginBottom: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: "rgba(217,119,6,0.35)",
  },
  timerBoxDone: { borderColor: "rgba(5,150,105,0.5)", backgroundColor: "#eafaf2" },
  timerText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 14,
    color: colors.earth950,
  },
  timerBtn: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: colors.warmSoft,
    borderWidth: 1,
    borderColor: "rgba(217,119,6,0.3)",
  },
  timerBtnText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 13,
    color: colors.warm,
  },
  donenessRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.leafSoft,
  },
  donenessText: {
    flex: 1,
    fontFamily: "DMSans_600SemiBold",
    fontSize: 12,
    lineHeight: 17,
    color: colors.earth950,
  },
  whyToggle: {
    marginTop: 10,
    fontFamily: "DMSans_700Bold",
    fontSize: 12,
    color: colors.warm,
  },
  whyText: {
    marginTop: 4,
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    lineHeight: 18,
    color: colors.earth600,
  },
  errFull: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 32,
    backgroundColor: colors.canvas,
  },
  errEmoji: { fontSize: 44 },
  errTitle: {
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 22,
    color: colors.earth950,
  },
  errBody: {
    textAlign: "center",
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: colors.earth600,
  },
  errBtn: {
    marginTop: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: colors.leaf,
  },
  errBtnText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 14,
    color: colors.white,
  },
  liveCircle: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  liveBottom: { position: "absolute", left: 16, right: 16, bottom: 24, gap: 12 },
  coachBubble: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  pulseWrap: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: colors.warmSoft,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.warm,
  },
  coachLabel: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.earth600,
  },
  coachText: {
    marginTop: 3,
    fontFamily: "DMSans_400Regular",
    fontSize: 15,
    lineHeight: 20,
    color: colors.earth950,
  },
  guidanceCard: {
    padding: 20,
    borderRadius: 28,
    backgroundColor: colors.canvas,
  },
  guidanceTitle: {
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 23,
    lineHeight: 27,
    color: colors.earth950,
  },
  buttonRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  backButton: {
    flex: 1,
    paddingVertical: 13,
    alignItems: "center",
    borderRadius: 16,
    backgroundColor: colors.earth100,
  },
  backButtonText: {
    fontFamily: "DMSans_500Medium",
    color: colors.earth950,
  },
  nextButton: {
    flex: 2,
    paddingVertical: 13,
    alignItems: "center",
    borderRadius: 16,
    backgroundColor: colors.earth950,
  },
  nextButtonText: {
    fontFamily: "DMSans_600SemiBold",
    color: colors.canvas,
  },
  iconButtonLight: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "rgba(247,250,249,0.9)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  iconButtonDark: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  center: { alignItems: "center", paddingTop: 8 },
  centerText: { marginTop: 8, textAlign: "center" },
  leafRound: {
    width: 56,
    height: 56,
    marginBottom: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    backgroundColor: colors.leafSoft,
    borderWidth: 1,
    borderColor: "rgba(5,150,105,0.15)",
  },
  feedbackCard: {
    flex: 1,
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
  },
  whitePanel: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  noticeRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginTop: 12 },
  noticeDot: { width: 6, height: 6, marginTop: 7, borderRadius: 3 },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  smallEarthBox: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.earth100,
  },
  savingsSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderRadius: 24,
    backgroundColor: colors.leafSoft,
    borderWidth: 1,
    borderColor: "rgba(5,150,105,0.15)",
  },
  whiteIconBox: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  moneyText: {
    marginTop: 4,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 32,
    color: colors.earth950,
  },
  warmSmall: {
    fontFamily: "DMSans_500Medium",
    fontSize: 11,
    color: colors.warm,
  },
  leafSmall: {
    fontFamily: "DMSans_500Medium",
    fontSize: 11,
    color: colors.leaf,
  },
  swapCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  swapLine: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: colors.earth950,
  },
  strike: { color: colors.earth600, textDecorationLine: "line-through" },
  savePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.leafSoft,
  },
  saveText: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 11,
    color: colors.leaf,
  },
  saleCard: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: colors.warmSoft,
    borderWidth: 1,
    borderColor: "rgba(217,119,6,0.15)",
  },
  saleTitle: {
    marginTop: 8,
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 22,
    lineHeight: 26,
    color: colors.earth950,
  },
  tipCard: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  avatar: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: colors.warmSoft,
  },
  avatarText: {
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 22,
    color: colors.warm,
  },
  profileName: {
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 24,
    color: colors.earth950,
  },
  circleWhite: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  skillRow: { marginBottom: 16 },
  savedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  savedEmoji: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.earth100,
  },
  prefBox: {
    overflow: "hidden",
    borderRadius: 24,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  prefRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.earth200,
  },
  settingsRow: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  cameraSafe: { flex: 1, backgroundColor: colors.earth950 },
  cameraTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  iconButtonSpacer: { width: 40, height: 40 },
  cameraViewport: { flex: 1, overflow: "hidden" },
  permissionPanel: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  cameraIconLarge: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: colors.warmSoft,
  },
  cameraTitle: {
    marginTop: 20,
    textAlign: "center",
    fontFamily: "SpaceGrotesk_600SemiBold",
    fontSize: 28,
    color: colors.white,
  },
  cameraBody: {
    marginTop: 8,
    maxWidth: 320,
    textAlign: "center",
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(255,255,255,0.7)",
  },
  cameraBullets: { marginTop: 20, gap: 8 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  cameraBulletText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
  cameraShots: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  cameraShotTitle: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.7)",
  },
  cameraClear: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
  },
  cameraThumbWrap: { marginTop: 8, marginRight: 8 },
  cameraThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  cameraThumbLabel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
    textAlign: "center",
    fontFamily: "DMSans_500Medium",
    fontSize: 8,
    color: colors.white,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  cameraControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: colors.earth950,
  },
  shutter: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 36,
    backgroundColor: colors.white,
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.2)",
  },
  shutterInner: {
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 30,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.earth950,
  },
  doneButton: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.warm,
  },
  doneDisabled: { backgroundColor: "rgba(255,255,255,0.1)" },
  doneText: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 14,
    color: colors.white,
  },
  doneTextDisabled: { color: "rgba(255,255,255,0.4)" },
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: "rgba(247,250,249,0.92)",
    borderTopWidth: 1,
    borderTopColor: "rgba(231,225,216,0.7)",
  },
  navItem: { flex: 1, alignItems: "center", gap: 4 },
  navIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  navIconActive: { backgroundColor: colors.earth950 },
  navText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 10,
    color: colors.earth600,
  },
  navTextActive: { color: colors.earth950 },

  // --- scan result + matches ---
  mt4: { marginTop: 4 },
  leafText: { color: colors.leaf },
  scanResult: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.leafSoft,
    borderWidth: 1,
    borderColor: "rgba(5,150,105,0.18)",
  },
  scanHint: {
    marginTop: 8,
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    fontStyle: "italic",
    color: colors.earth600,
  },
  matchCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    marginBottom: 10,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  matchTile: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.warmSoft,
  },
  matchTileFull: { backgroundColor: colors.leafSoft },
  matchPct: { fontFamily: "DMSans_700Bold", fontSize: 15 },
  matchCardV2: { marginBottom: 12 },
  matchPctWrap: { flexDirection: "row", alignItems: "baseline" },
  matchPctBig: { fontFamily: "DMSans_700Bold", fontSize: 26, lineHeight: 28 },
  matchPctUnit: { fontFamily: "DMSans_600SemiBold", fontSize: 13, marginLeft: 1 },
  leafIconBox: { backgroundColor: colors.leafSoft },

  // --- recipe kit with amounts ---
  kitList: { gap: 8 },
  kitRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  kitDot: { width: 8, height: 8, borderRadius: 4 },
  kitDotHave: { backgroundColor: colors.leaf },
  kitDotMissing: { backgroundColor: colors.warm },
  kitName: {
    fontFamily: "DMSans_500Medium",
    fontSize: 14,
    color: colors.earth950,
  },
  kitAmount: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: colors.earth600,
  },

  // --- missing-ingredients card ---
  missingCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.warmSoft,
    borderWidth: 1,
    borderColor: "rgba(217,119,6,0.18)",
  },
  missingButton: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(217,119,6,0.25)",
  },
  missingButtonText: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 13,
    color: colors.warm,
  },

  pulseDotLocked: { backgroundColor: colors.leaf },

  // --- review system ---
  reviewCard: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  reviewQ: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 15,
    color: colors.earth950,
  },
  starRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  reviewTag: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.earth100,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  reviewTagOn: { backgroundColor: colors.warmSoft, borderColor: "rgba(217,119,6,0.3)" },
  reviewTagText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 12,
    color: colors.earth800,
  },
  reviewTagTextOn: { color: colors.warm },
  reviewSubmit: {
    marginTop: 20,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: colors.warm,
  },
  reviewSubmitOff: { backgroundColor: colors.earth400 },
  reviewSubmitText: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 14,
    color: colors.white,
  },
  reviewErr: {
    marginTop: 8,
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: colors.warm,
  },

  // --- flyers / nearby deals ---
  shopChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(217,119,6,0.25)",
  },
  shopChipText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 12,
    color: colors.warm,
  },
  flyerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    marginBottom: 10,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  flyerIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.warmSoft,
  },
  flyerDist: { fontFamily: "DMSans_500Medium", fontSize: 11, color: colors.earth600 },
  mb10: { marginBottom: 10 },
  openNow: { fontFamily: "DMSans_700Bold", color: colors.leaf },
  closedNow: { fontFamily: "DMSans_700Bold", color: "#dc2626" },
  flyerDeal: {
    marginTop: 2,
    fontFamily: "DMSans_600SemiBold",
    fontSize: 13,
    color: colors.leaf,
  },
  flyerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: colors.earth950,
  },
  flyerButtonText: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 14,
    color: colors.canvas,
  },

  // --- layout system: sticky footer, layered cards, bento ---
  shellWithFooter: { paddingBottom: 184 },
  stickyFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 78,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: "rgba(247,250,249,0.94)",
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  stickyHint: {
    marginTop: 8,
    textAlign: "center",
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: colors.earth600,
  },
  cardBase: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: colors.white,
    shadowColor: "#0f172a",
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardWhite: { backgroundColor: colors.white },
  cardWarm: { backgroundColor: colors.warmSoft },
  cardLeaf: { backgroundColor: colors.leafSoft },
  cardPanel: { backgroundColor: "rgba(241,245,249,0.85)" },

  // bento grid
  bentoRow: { flexDirection: "row", gap: 12 },
  bentoCol: { flex: 1, gap: 12 },
  bentoFill: { flex: 1 },
  tilePressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  pressedBtn: { opacity: 0.9 },
  tileLabel: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.earth600,
  },
  tileMetric: {
    marginTop: 4,
    fontFamily: "DMSans_600SemiBold",
    fontSize: 22,
    color: colors.earth950,
  },
  tileEmoji: { fontSize: 30 },
  tileBody: {
    marginTop: 6,
    fontFamily: "DMSans_500Medium",
    fontSize: 13,
    lineHeight: 18,
    color: colors.earth950,
  },
  resumeBadge: {
    alignSelf: "flex-start",
    marginTop: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.white,
  },
  resumeBadgeText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 12,
    color: "#b45309",
  },

  // --- dark hero + gradient tiles + glass (Tech Fresh bold) ---
  heroDark: {
    padding: 22,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#0f172a", // solid fallback under the gradient
    shadowColor: "#0f172a",
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  heroEyebrow: {
    fontFamily: "DMSans_700Bold",
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.65)",
  },
  heroTitle: {
    marginTop: 8,
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 34,
    lineHeight: 38,
    color: colors.white,
  },
  heroAccent: { color: "#34d399" },
  heroChips: { marginTop: 16, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  heroChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  heroChipText: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 12,
    color: "rgba(255,255,255,0.92)",
  },
  gradientTile: { overflow: "hidden", shadowOpacity: 0.35, shadowRadius: 14, elevation: 5 },
  tileLabelLight: {
    fontFamily: "DMSans_700Bold",
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.75)",
  },
  tileMetricLight: {
    marginTop: 4,
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 24,
    color: colors.white,
  },
  tileBodyLight: {
    marginTop: 6,
    fontFamily: "DMSans_600SemiBold",
    fontSize: 14,
    lineHeight: 19,
    color: colors.white,
  },
  tileIconGlass: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
  },

  // --- onboarding dark ---
  onboardingDark: { flex: 1, backgroundColor: "#0f172a" },
  glowBlob: {
    position: "absolute",
    width: 340,
    height: 340,
    borderRadius: 170,
    opacity: 0.35,
  },
  glowGreen: { top: -110, right: -100, backgroundColor: "#065f46" },
  glowAmber: { bottom: -130, left: -110, backgroundColor: "#78350f" },
  onboardBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(52,211,153,0.12)",
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.35)",
  },
  onboardBadgeText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 10,
    letterSpacing: 1.6,
    color: "#34d399",
  },
  heroDarkTitle: {
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 44,
    lineHeight: 48,
    color: colors.white,
  },
  heroDarkBody: {
    maxWidth: 320,
    fontFamily: "DMSans_400Regular",
    fontSize: 15,
    lineHeight: 23,
    color: "rgba(255,255,255,0.7)",
  },
  glassRow: {
    flexDirection: "row",
    gap: 16,
    padding: 18,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  glassIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "rgba(251,191,36,0.14)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.3)",
  },
  glassIconLeaf: {
    backgroundColor: "rgba(52,211,153,0.14)",
    borderColor: "rgba(52,211,153,0.3)",
  },
  glassTitle: {
    fontFamily: "DMSans_700Bold",
    fontSize: 15,
    lineHeight: 20,
    color: colors.white,
  },
  glassBody: {
    marginTop: 4,
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(255,255,255,0.62)",
  },
  smallCenterDark: {
    marginTop: 12,
    textAlign: "center",
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
  },
});
