import { useState } from "react";
import { signInWithGoogle } from "../../lib/auth.js";
import LandingNav from "./LandingNav.js";
import LandingHero from "./LandingHero.js";
import LandingWorkshop from "./LandingWorkshop.js";
import type { WorkshopJoinState } from "./LandingWorkshop.js";
import LandingValue from "./LandingValue.js";
import LandingHowItWorks from "./LandingHowItWorks.js";
import LandingFeatures from "./LandingFeatures.js";
import LandingBoxes from "./LandingBoxes.js";
import LandingRoles from "./LandingRoles.js";
import LandingCTA from "./LandingCTA.js";
import LandingFooter from "./LandingFooter.js";
import { useTheme } from "./useTheme.js";

interface LandingPageProps {
  /** Guest seat-code join state, owned by App (it flips `user` on success). */
  workshop: WorkshopJoinState;
}

export default function LandingPage({ workshop }: LandingPageProps) {
  const [signingIn, setSigningIn] = useState(false);
  const { isDark, toggle } = useTheme();

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      console.error("Sign-in failed:", e);
      setSigningIn(false);
    }
  };

  return (
    <div
      className={
        "landing-bg min-h-full w-full overflow-y-auto transition-colors " +
        (isDark ? "dark" : "")
      }
    >
      <LandingNav
        onSignIn={handleSignIn}
        signingIn={signingIn}
        isDark={isDark}
        onToggleTheme={toggle}
      />
      <main>
        <LandingHero onSignIn={handleSignIn} signingIn={signingIn} />
        <LandingWorkshop workshop={workshop} onSignIn={handleSignIn} />
        <LandingValue />
        <LandingHowItWorks />
        <LandingFeatures />
        <LandingBoxes />
        <LandingRoles />
        <LandingCTA onSignIn={handleSignIn} signingIn={signingIn} />
      </main>
      <LandingFooter />
    </div>
  );
}
