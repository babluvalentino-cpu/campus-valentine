// Smart Icebreaker Generator for matches
// Generates conversation starters based on profile compatibility

export interface IcebreakerContext {
  username_a: string;
  username_b: string;
  sports_intersection?: string[];
  dietary_pref_a?: string;
  dietary_pref_b?: string;
  shared_interests?: string[];
  sports_score?: number;
}

/**
 * Generates a smart icebreaker based on match compatibility
 * Uses sports, dietary preferences, and interests
 */
export function generateSmartIcebreaker(context: IcebreakerContext): string {
  const icebreakers: string[] = [];

  // Sports-based icebreakers
  if (
    context.sports_intersection &&
    context.sports_intersection.length > 0
  ) {
    const sport = context.sports_intersection[0];
    const sportLabel = sportToLabel(sport);

    icebreakers.push(
      `You both love ${sportLabel}! Who's the better player? 😏`
    );
    icebreakers.push(
      `${sportLabel} fanatics? Let's settle this: who's your GOAT in this sport?`
    );
    icebreakers.push(
      `So you both play ${sportLabel}? Want to team up for a match on campus?`
    );
  }

  // Dietary compatibility icebreakers
  if (context.dietary_pref_a && context.dietary_pref_b) {
    const dietA = dietaryToLabel(context.dietary_pref_a);
    const dietB = dietaryToLabel(context.dietary_pref_b);

    if (context.dietary_pref_a === context.dietary_pref_b) {
      icebreakers.push(
        `Both ${dietA}? Let's find the best ${dietA} place on campus! 🍽️`
      );
      icebreakers.push(
        `Fellow ${dietA} person! What's your go-to food spot near campus?`
      );
    } else {
      icebreakers.push(
        `${dietA} and ${dietB} – can we make this work? 😄 Let's find a restaurant both of us will love!`
      );
      icebreakers.push(
        `One ${dietA}, one ${dietB}... the real question is: where do we eat? 🤔`
      );
    }
  }

  // Generic engaging icebreakers (fallback)
  icebreakers.push(
    `Hey! What's something you love about campus life that most people miss?`
  );
  icebreakers.push(
    `If you could plan the perfect date on campus, what would it be?`
  );
  icebreakers.push(`What's your favorite hidden gem on campus?`);
  icebreakers.push(
    `Quick question: late-night maggi at 2 AM or fancy dinner? 😄`
  );
  icebreakers.push(`What's one thing about you that would surprise people?`);

  // Return random icebreaker (could also return first one)
  return icebreakers[Math.floor(Math.random() * icebreakers.length)];
}

function sportToLabel(sport: string): string {
  const sportLabels: Record<string, string> = {
    table_tennis: "Table Tennis",
    basketball: "Basketball",
    football: "Football",
    chess: "Chess",
    carrom: "Carrom",
    badminton: "Badminton",
    volleyball: "Volleyball",
    lawn_tennis: "Lawn Tennis",
    none: "Sports",
  };
  return sportLabels[sport] || sport;
}

function dietaryToLabel(dietary: string): string {
  const dietLabels: Record<string, string> = {
    veg: "vegetarian",
    non_veg: "non-vegetarian",
    jain: "Jain",
    vegan: "vegan",
  };
  return dietLabels[dietary] || dietary;
}
