const STORAGE_KEY = "premiumPokerTrainer_v1";

const DEFAULT_STATE = {
  mode: "cash",
  difficulty: "beginner",
  section: "trainer",
  current: null,
  shownIds: [],
  stats: {
    cash: {
      hands: 0,
      correct: 0,
      streak: 0,
      best: 0,
      leaks: {}
    },
    tournament: {
      hands: 0,
      correct: 0,
      streak: 0,
      best: 0,
      leaks: {}
    }
  }
};

let app = JSON.parse(localStorage.getItem(STORAGE_KEY)) || structuredClone(DEFAULT_STATE);

const suits = ["♠", "♥", "♦", "♣"];

const handPools = {
  premium: ["A♠ A♦", "K♠ K♦", "Q♠ Q♦", "A♠ K♠", "A♣ K♦"],
  strong: ["J♠ J♦", "T♠ T♦", "A♠ Q♠", "A♣ Q♦", "K♠ Q♠", "A♥ J♥"],
  medium: ["9♠ 9♦", "8♠ 8♦", "A♠ T♠", "K♣ J♣", "Q♠ J♠", "J♦ T♦"],
  speculative: ["7♠ 7♦", "6♣ 6♥", "A♠ 5♠", "T♠ 9♠", "9♦ 8♦", "8♣ 7♣", "7♥ 6♥"],
  weak: ["K♠ 7♦", "Q♣ 8♦", "J♠ 6♣", "T♥ 4♥", "9♣ 3♦", "7♠ 2♣"]
};

const boardPools = {
  dryHigh: [
    "K♦ 8♣ 3♠",
    "A♣ 7♦ 2♥",
    "Q♠ 6♣ 2♦",
    "J♥ 5♠ 2♣"
  ],
  wetHigh: [
    "K♦ Q♦ 9♣",
    "Q♠ J♠ 8♥",
    "J♦ T♦ 7♣",
    "A♠ T♠ 9♦"
  ],
  lowConnected: [
    "9♠ 8♠ 6♦",
    "T♦ 9♦ 7♣",
    "J♣ T♣ 8♥",
    "8♥ 7♥ 5♠"
  ],
  scaryRiver: [
    "Q♠ 9♣ 8♣ 7♥ J♣",
    "K♦ T♦ 6♠ 9♦ 2♦",
    "A♣ J♠ 7♠ T♠ 4♠",
    "J♥ T♥ 8♣ 7♦ 9♠"
  ]
};

const leakTypes = [
  "Too passive preflop",
  "Overfolding big blind",
  "Missing profitable jams",
  "Missing value bets",
  "Poor bet sizing",
  "Overcalling rivers",
  "Bluffing bad boards",
  "Ignoring board texture",
  "Calling too light in tournaments",
  "Not adjusting to player type"
];

const playerTypes = [
  {
    name: "Calling Station",
    exploit: "Value bet thinner and bluff less. They call too much."
  },
  {
    name: "Nit",
    exploit: "Steal more often, but respect big aggression."
  },
  {
    name: "Maniac",
    exploit: "Trap more often and avoid over-bluffing into them."
  },
  {
    name: "Passive Player",
    exploit: "Value bet often. Big raises are usually strong."
  },
  {
    name: "Regular",
    exploit: "Use a balanced strategy and pay attention to blockers."
  }
];

const positionOrderPreflop = ["UTG", "HJ", "CO", "BTN", "SB", "BB"];
const positionOrderPostflop = ["SB", "BB", "UTG", "HJ", "CO", "BTN"];

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(app));
}

function getStats() {
  return app.stats[app.mode];
}

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function percent(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function cleanId(value) {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");
}

function makeId(parts) {
  return cleanId(parts.join("_"));
}

function splitCards(cardString) {
  return cardString.split(" ");
}

function cardClass(card) {
  return card.includes("♥") || card.includes("♦") ? "card red" : "card";
}

function pickLeakFocus() {
  const leaks = getStats().leaks;
  const entries = Object.entries(leaks);

  if (!entries.length || Math.random() < 0.35) {
    return rand(leakTypes);
  }

  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

function generatePreflopSpot() {
  const leak = pickLeakFocus();
  const mode = app.mode;
  const stack = mode === "cash"
    ? rand([80, 100, 120, 150])
    : rand([8, 10, 12, 15, 18, 20, 25, 30, 40]);

  let heroPosition = rand(["UTG", "HJ", "CO", "BTN", "SB", "BB"]);
  let hand;
  let correct;
  let options = ["Fold", "Call", "Raise", "3-bet", "All-in"];
  let spot;
  let tableAction = {};
  let simple;
  let advanced;
  let exploit;
  let concept;

  const villain = rand(playerTypes);

  if (mode === "tournament" && stack <= 15 && leak === "Missing profitable jams") {
    heroPosition = rand(["BTN", "SB", "CO"]);
    hand = rand([...handPools.strong, ...handPools.medium]);
    correct = "All-in";
    spot = `${modeLabel()} — ${stack}bb effective. Action folds to you in the ${heroPosition}.`;
    simple = `At ${stack}bb, ${hand} is strong enough to shove. You win the blinds when everyone folds and still have good equity when called.`;
    advanced = "Short-stack tournament poker rewards fold equity. Hands with strong high-card value perform well as jams because they deny equity and avoid awkward postflop SPR spots.";
    exploit = `${villain.name}: ${villain.exploit}`;
    concept = "Push/fold and fold equity";
  } else if (heroPosition === "BB") {
    hand = rand([...handPools.medium, ...handPools.speculative]);
    correct = "Call";
    spot = `${modeLabel()} — ${stack}bb effective. Button opens to 2.5bb. You are in the Big Blind.`;
    tableAction = { BTN: "Raises 2.5bb", SB: "Folds", BB: "Hero to act" };
    simple = `${hand} is good enough to defend against a Button open. You are getting a price and the Button has a wide range.`;
    advanced = "The Big Blind closes the action and has already invested chips. Against late-position opens, suited and connected hands realise enough equity to call.";
    exploit = `${villain.name}: ${villain.exploit}`;
    concept = "Blind defence";
  } else if (["CO", "BTN", "SB"].includes(heroPosition)) {
    hand = rand([...handPools.strong, ...handPools.medium, ...handPools.speculative]);
    correct = "Raise";
    spot = `${modeLabel()} — ${stack}bb effective. Folds to you in the ${heroPosition}.`;
    tableAction = { [heroPosition]: "Hero to act" };
    simple = `${hand} should usually be opened from ${heroPosition}. You can win the blinds or play with initiative.`;
    advanced = "Late position allows wider opening because fewer players remain and you often have positional advantage postflop.";
    exploit = `${villain.name}: ${villain.exploit}`;
    concept = "Opening ranges";
  } else {
    hand = Math.random() < 0.65
      ? rand([...handPools.premium, ...handPools.strong])
      : rand([...handPools.speculative, ...handPools.weak]);

    const strongEnough = [...handPools.premium, ...handPools.strong].includes(hand);
    correct = strongEnough ? "Raise" : "Fold";
    spot = `${modeLabel()} — ${stack}bb effective. Folds to you in ${heroPosition}.`;
    tableAction = { [heroPosition]: "Hero to act" };
    simple = strongEnough
      ? `${hand} is strong enough to open from early position.`
      : `${hand} is too loose from early position. You will be dominated too often.`;
    advanced = "Early-position ranges must be tighter because more players are left to act behind you.";
    exploit = `${villain.name}: ${villain.exploit}`;
    concept = "Position discipline";
  }

  if (!Object.keys(tableAction).length) {
    tableAction = { [heroPosition]: "Hero to act" };
  }

  return {
    id: makeId([
      "preflop",
      mode,
      heroPosition,
      stack,
      hand,
      correct,
      spot
    ]),
    type: "preflop",
    title: "Preflop Decision",
    mode,
    heroPosition,
    villainType: villain.name,
    stack,
    pot: mode === "cash" ? 1.5 : 2.5,
    hand,
    board: "",
    spot,
    actionText: spot,
    tableAction,
    legalActions: options,
    correctAction: correct,
    idealBet: null,
    minBet: null,
    maxBet: null,
    leak,
    concept,
    simple,
    advanced,
    exploit
  };
}

function generatePostflopSpot() {
  const mode = app.mode;
  const leak = pickLeakFocus();
  const stack = mode === "cash"
    ? rand([62, 75, 90, 100, 125])
    : rand([12, 18, 24, 32, 45]);

  const pot = rand([5.5, 7.5, 9, 12, 16, 24, 38]);
  const heroPosition = rand(["BTN", "CO", "BB", "SB"]);
  const villain = rand(playerTypes);

  let hand;
  let board;
  let street;
  let legalActions;
  let correctAction;
  let idealBet = null;
  let minBet = null;
  let maxBet = null;
  let simple;
  let advanced;
  let exploit;
  let concept;
  let actionText;
  let tableAction = {};

  if (leak === "Missing value bets") {
    hand = rand(["A♠ K♠", "K♣ Q♣", "A♦ Q♦", "Q♠ J♠"]);
    board = rand(boardPools.dryHigh);
    street = "Flop";
    legalActions = ["Check", "Bet"];
    correctAction = "Bet";
    idealBet = roundHalf(pot * 0.6);
    minBet = roundHalf(pot * 0.4);
    maxBet = roundHalf(pot * 0.85);
    actionText = `You raised preflop from ${heroPosition}. One player called. Villain checks to you on the flop.`;
    tableAction = { [heroPosition]: "Hero to act", BB: "Checks" };
    simple = "You have a strong one-pair value hand. Bet because worse hands can call and you do not want to give free cards.";
    advanced = "As the preflop aggressor on a dry high-card board, you retain range advantage and can value bet top-pair type hands at high frequency.";
    exploit = `${villain.name}: ${villain.exploit}`;
    concept = "Value betting";
  } else if (leak === "Poor bet sizing") {
    hand = rand(["A♠ K♠", "K♦ Q♦", "Q♣ J♣", "J♠ T♠"]);
    board = rand(boardPools.wetHigh);
    street = "Flop";
    legalActions = ["Check", "Bet"];
    correctAction = "Bet";
    idealBet = roundHalf(pot * 0.75);
    minBet = roundHalf(pot * 0.55);
    maxBet = roundHalf(pot * 0.95);
    actionText = `You raised preflop and got one caller. The board is coordinated and draw-heavy. Villain checks.`;
    tableAction = { [heroPosition]: "Hero to act", BB: "Checks" };
    simple = "You should bet, but size bigger. On wet boards, small bets give draws too good a price.";
    advanced = "Connected boards shift equity more dynamically, so value hands often prefer larger sizing to charge draws and deny equity.";
    exploit = `${villain.name}: ${villain.exploit}`;
    concept = "Bet sizing";
  } else if (leak === "Overcalling rivers" || leak === "Calling too light in tournaments") {
    hand = rand(["A♦ Q♦", "K♠ Q♠", "Q♣ J♣", "A♣ J♣"]);
    board = rand(boardPools.scaryRiver);
    street = "River";
    legalActions = ["Fold", "Call", "Raise"];
    correctAction = "Fold";
    actionText = `You raised preflop, bet flop, checked turn. Villain now makes a large river bet into ${pot}bb.`;
    tableAction = { [heroPosition]: "Hero to act", BB: "Big river bet" };
    simple = "This river completes too many strong hands. One pair is not enough against a big river bet unless villain is bluffing too much.";
    advanced = "When front-door draws and straight regions complete, bluff-catching needs strong blockers or a specific read. Population pools often under-bluff big river bets.";
    exploit = `${villain.name}: ${villain.exploit}`;
    concept = "Bluff catching";
  } else if (leak === "Bluffing bad boards" || leak === "Ignoring board texture") {
    hand = rand(["A♠ Q♦", "K♣ J♦", "A♥ T♣", "Q♦ T♠"]);
    board = rand(boardPools.lowConnected);
    street = "Flop";
    legalActions = ["Check", "Bet"];
    correctAction = "Check";
    actionText = `You raised preflop from ${heroPosition}. Big Blind called. The flop is low and connected. Villain checks.`;
    tableAction = { [heroPosition]: "Hero to act", BB: "Checks" };
    simple = "This board connects with the Big Blind more than you. Checking back is often better than forcing a bad bluff.";
    advanced = "Low connected textures reduce the preflop raiser's range advantage. The caller has more two pair, sets, pair-plus-draws, and straights.";
    exploit = `${villain.name}: ${villain.exploit}`;
    concept = "Board texture";
  } else {
    hand = rand(["9♠ 9♦", "A♠ J♠", "K♦ Q♦", "T♣ T♥"]);
    board = rand(boardPools.wetHigh);
    street = rand(["Flop", "Turn"]);
    legalActions = ["Fold", "Call", "Raise"];
    correctAction = "Call";
    actionText = `You face a medium-sized bet on a dynamic board. Your hand has showdown value but is not strong enough to raise.`;
    tableAction = { [heroPosition]: "Hero to act", BB: "Bets" };
    simple = "Calling keeps worse hands and bluffs in. Raising would isolate you against stronger hands too often.";
    advanced = "Medium-strength hands often prefer call lines because they realise equity without overplaying against stronger continuing ranges.";
    exploit = `${villain.name}: ${villain.exploit}`;
    concept = "Pot control";
  }

  return {
    id: makeId([
      "postflop",
      mode,
      heroPosition,
      stack,
      pot,
      hand,
      board,
      street,
      correctAction,
      concept
    ]),
    type: "postflop",
    title: `${street} Decision`,
    mode,
    heroPosition,
    villainType: villain.name,
    stack,
    pot,
    hand,
    board,
    spot: actionText,
    actionText,
    tableAction,
    legalActions,
    correctAction,
    idealBet,
    minBet,
    maxBet,
    leak,
    concept,
    simple,
    advanced,
    exploit
  };
}

function roundHalf(value) {
  return Math.round(value * 2) / 2;
}

function generateUniqueQuestion() {
  for (let i = 0; i < 250; i++) {
    const q = app.section === "preflop"
      ? generatePreflopSpot()
      : generatePostflopSpot();

    if (!app.shownIds.includes(q.id)) {
      app.shownIds.push(q.id);
      save();
      return q;
    }
  }

  app.shownIds = [];
  const q = app.section === "preflop"
    ? generatePreflopSpot()
    : generatePostflopSpot();

  app.shownIds.push(q.id);
  save();
  return q;
}

function newQuestion() {
  app.current = generateUniqueQuestion();
  save();
  render();
}

function setMode(mode) {
  app.mode = mode;
  newQuestion();
}

function setDifficulty(difficulty) {
  app.difficulty = difficulty;
  render();
}

function setSection(section) {
  app.section = section;
  newQuestion();
}

function answer(action) {
  const q = app.current;

  if (!q.legalActions.includes(action)) {
    showResult(false, "Illegal action", "That action is not available in this spot.");
    return;
  }

  if (action === "Bet" || action === "Raise") {
    const input = document.getElementById("betSize");
    const size = input ? Number(input.value) : null;

    if (q.idealBet && (!size || size <= 0)) {
      showResult(false, "Enter your size", "For bet or raise spots, type the amount in big blinds first.");
      return;
    }

    if (q.minBet && size < q.minBet) {
      recordAnswer(false);
      showResult(
        false,
        "Sizing too small",
        `Your action was right, but the size was too small. A better size is around ${q.idealBet}bb.`
      );
      return;
    }

    if (q.maxBet && size > q.maxBet) {
      recordAnswer(false);
      showResult(
        false,
        "Sizing too large",
        `Your action was right, but the size was too large. A better size is around ${q.idealBet}bb.`
      );
      return;
    }
  }

  const correct = action === q.correctAction;
  recordAnswer(correct);

  showResult(
    correct,
    correct ? "Correct decision" : `Best answer: ${q.correctAction}`,
    q.simple
  );
}

function recordAnswer(correct) {
  const s = getStats();
  s.hands++;

  if (correct) {
    s.correct++;
    s.streak++;
    s.best = Math.max(s.best, s.streak);
  } else {
    s.streak = 0;
    const leak = app.current.leak;
    s.leaks[leak] = (s.leaks[leak] || 0) + 1;
  }

  save();
}

function showResult(correct, title, message) {
  const q = app.current;
  const result = document.getElementById("result");

  result.innerHTML = `
    <div class="result-card ${correct ? "correct" : "wrong"}">
      <h3>${correct ? "✅ Correct" : "❌ Not quite"}</h3>
      <p><strong>${title}</strong></p>
      <p>${message}</p>

      <details open>
        <summary>Beginner explanation</summary>
        <p>${q.simple}</p>
      </details>

      <details>
        <summary>Advanced explanation</summary>
        <p>${q.advanced}</p>
      </details>

      <details>
        <summary>Low-stakes exploit adjustment</summary>
        <p>${q.exploit}</p>
      </details>

      <details>
        <summary>Concept trained</summary>
        <p>${q.concept}</p>
      </details>

      <button class="next-btn" onclick="newQuestion()">Next hand</button>
    </div>
  `;

  renderStats();
}

function resetProgress() {
  const confirmed = confirm("Reset all progress and question history?");
  if (!confirmed) return;

  app = structuredClone(DEFAULT_STATE);
  save();
  newQuestion();
}

function modeLabel() {
  return app.mode === "cash" ? "Cash Game" : "Tournament";
}

function renderSeats(q) {
  const stacks = {
    UTG: q.stack,
    HJ: q.stack,
    CO: q.stack,
    BTN: q.stack,
    SB: q.stack,
    BB: q.stack
  };

  return positionOrderPreflop.map(pos => {
    const isHero = pos === q.heroPosition;
    const action = q.tableAction[pos] || "";
    return `
      <div class="seat seat-${pos} ${isHero ? "hero-seat" : ""}">
        <div class="pos">${isHero ? "Hero" : "Villain"} · ${pos}</div>
        <div class="stack">${stacks[pos]}bb</div>
        ${action ? `<div class="action">${action}</div>` : ""}
      </div>
    `;
  }).join("");
}

function renderCards(cardString) {
  if (!cardString) return "";
  return splitCards(cardString).map(card => {
    return `<div class="${cardClass(card)}">${card}</div>`;
  }).join("");
}

function renderStats() {
  const statsEl = document.getElementById("statsPanel");
  if (!statsEl) return;

  const s = getStats();
  const acc = percent(s.correct, s.hands);
  const leaks = Object.entries(s.leaks).sort((a, b) => b[1] - a[1]);

  statsEl.innerHTML = `
    <h3>Your Training Dashboard</h3>

    <div class="stat-grid">
      <div class="stat-card">
        <strong>${s.hands}</strong>
        <span>Hands played</span>
      </div>
      <div class="stat-card">
        <strong>${acc}%</strong>
        <span>Accuracy</span>
      </div>
      <div class="stat-card">
        <strong>${s.streak}</strong>
        <span>Current streak</span>
      </div>
      <div class="stat-card">
        <strong>${s.best}</strong>
        <span>Best streak</span>
      </div>
    </div>

    <div class="lesson-box">
      <h4>Current Focus</h4>
      <p>The trainer studies your mistakes and gives you new hands that target the same leak, without repeating the exact same spot.</p>
    </div>

    <div class="leak-list">
      <h3>Common Leaks</h3>
      ${
        leaks.length
          ? leaks.map(([leak, count]) => `
              <div class="leak-item">
                <strong>${leak}</strong><br />
                ${count} mistake${count === 1 ? "" : "s"}
              </div>
            `).join("")
          : `<div class="leak-item">No leaks tracked yet. Play a few hands first.</div>`
      }
    </div>

    <button class="reset-btn" onclick="resetProgress()">Reset Progress</button>
  `;
}

function render() {
  const q = app.current || generateUniqueQuestion();

  document.getElementById("app").innerHTML = `
    <div class="app-shell">
      <section class="hero">
        <div class="hero-badge">Premium Poker Training</div>
        <h1>Learn poker like a coach is sat beside you.</h1>
        <p>
          A solver-style poker trainer made for real players — with table visuals, beginner explanations,
          low-stakes exploit advice, leak tracking, and non-repeating generated hands.
        </p>
      </section>

      <main class="main-grid">
        <section class="panel trainer-panel">
          <div class="control-row">
            <button onclick="setMode('cash')" class="${app.mode === "cash" ? "active" : ""}">Cash Game</button>
            <button onclick="setMode('tournament')" class="${app.mode === "tournament" ? "active" : ""}">Tournament</button>
            <button onclick="setSection('preflop')" class="${app.section === "preflop" ? "active" : ""}">Preflop</button>
            <button onclick="setSection('postflop')" class="${app.section === "postflop" ? "active" : ""}">Postflop</button>
            <button onclick="setDifficulty('beginner')" class="${app.difficulty === "beginner" ? "active" : ""}">Beginner Coach</button>
            <button onclick="setDifficulty('advanced')" class="${app.difficulty === "advanced" ? "active" : ""}">Advanced</button>
          </div>

          <div class="spot-header">
            <div class="spot-title">
              <h2>${q.title}</h2>
              <p>${q.actionText}</p>
            </div>

            <div class="pill-row">
              <span class="pill green">${modeLabel()}</span>
              <span class="pill">${q.type}</span>
              <span class="pill">${q.stack}bb</span>
              <span class="pill">${q.concept}</span>
            </div>
          </div>

          <div class="poker-table-wrap">
            <div class="poker-table">
              ${renderSeats(q)}

              <div class="table-center">
                <div class="pot">Pot: ${q.pot}bb</div>

                ${
                  q.board
                    ? `
                      <div class="hero-hand-label">Board</div>
                      <div class="cards">${renderCards(q.board)}</div>
                    `
                    : ""
                }

                <div class="hero-hand-label">Your hand</div>
                <div class="cards">${renderCards(q.hand)}</div>
              </div>
            </div>
          </div>

          <div class="action-box">
            <h3>Hero to act</h3>
            <p>
              Choose the best decision. The app will explain the beginner answer,
              the advanced reasoning, and the low-stakes exploit adjustment.
            </p>

            ${
              q.idealBet
                ? `
                  <div class="bet-input">
                    <input id="betSize" type="number" step="0.5" placeholder="Bet size in bb — suggested around ${q.idealBet}bb" />
                  </div>
                `
                : ""
            }

            <div class="choice-grid">
              ${q.legalActions.map(action => `
                <button onclick="answer('${action}')">${action}</button>
              `).join("")}
            </div>

            <div id="result" class="result"></div>
          </div>
        </section>

        <aside class="panel side-panel" id="statsPanel"></aside>
      </main>
    </div>
  `;

  renderStats();
}

document.addEventListener("DOMContentLoaded", () => {
  if (!app.current) {
    newQuestion();
  } else {
    render();
  }
});
