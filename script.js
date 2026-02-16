// --- Settings & State ---
const RAW_ANSWERS_URL = "answers.txt"; 
const RAW_GUESSES_URL = "guesses.txt"; 

let allAnswers = [];
let allGuesses = [];
let possibleWords = [];
let activeAnswerSet = 'answers';
let currentSortKey = 'expectedRemaining';

const el = {
    input: document.getElementById("guessInput"),
    addBtn: document.getElementById("addRowBtn"),
    applyBtn: document.getElementById("applyBtn"),
    resetBtn: document.getElementById("resetBtn"),
    toggleBtn: document.getElementById("toggleAnswersBtn"),
    analyzeBtn: document.getElementById("analyzeBtn"),
    status: document.getElementById("status"),
    board: document.getElementById("board"),
    suggestions: document.getElementById("suggestions"),
    computing: document.getElementById("computing"),
    possibleCount: document.getElementById("possibleCount"),
    minGuesses: document.getElementById("minGuesses"),
    expectedAfter: document.getElementById("expectedAfter"),
    avgSkill: document.getElementById("avgSkill"),
    possibleAnswersWrap: document.getElementById("possibleAnswersWrap"),
    possibleAnswers: document.getElementById("possibleAnswers"),
    sortExp: document.getElementById("sortExpBtn"),
    sortEnt: document.getElementById("sortEntropyBtn"),
    sortScore: document.getElementById("sortScoreBtn")
};

// --- Initialization ---
async function init() {
    el.status.textContent = "Loading words...";
    try {
        const [resA, resG] = await Promise.all([
            fetch(RAW_ANSWERS_URL, { cache: "no-cache" }), 
            fetch(RAW_GUESSES_URL, { cache: "no-cache" })
        ]);
        
        allAnswers = (await resA.text()).split(/\r?\n/).map(s => s.trim().toLowerCase()).filter(s => s.length === 5);
        const uniqueGuesses = (await resG.text()).split(/\r?\n/).map(s => s.trim().toLowerCase()).filter(s => s.length === 5);
        allGuesses = Array.from(new Set([...uniqueGuesses, ...allAnswers]));
        
        resetAll();
        el.status.textContent = `Ready! ${allAnswers.length} answers loaded.`;
    } catch (e) {
        el.status.textContent = "Error loading word files.";
    }
}

// --- Event Listeners ---
el.addBtn.onclick = () => onAddRow(el.input.value);
el.applyBtn.onclick = onApplyFeedback;
el.resetBtn.onclick = resetAll;
el.toggleBtn.onclick = toggleAnswerMode;
el.analyzeBtn.onclick = promptAnalyze;
el.sortExp.onclick = () => setSort('expectedRemaining');
el.sortEnt.onclick = () => setSort('entropy');
el.sortScore.onclick = () => setSort('baseScore');
el.input.onkeydown = (e) => { if (e.key === "Enter") onAddRow(el.input.value); };

document.addEventListener("DOMContentLoaded", init);

// --- Core Logic ---

function resetAll() {
    possibleWords = activeAnswerSet === 'answers' ? [...allAnswers] : [...allGuesses];
    el.board.innerHTML = "";
    el.avgSkill.textContent = "—";
    el.input.value = "";
    updateStatsAndSuggestions();
}

function toggleAnswerMode() {
    activeAnswerSet = activeAnswerSet === 'answers' ? 'guesses' : 'answers';
    el.toggleBtn.textContent = `Answers: ${activeAnswerSet === 'answers' ? 'Official Set' : 'ALL Guesses'}`;
    resetAll();
}

function getPattern(guess, solution) {
    const g = guess.split(""), s = solution.split("");
    const pattern = [0, 0, 0, 0, 0], counts = {};
    for (let i = 0; i < 5; i++) {
        if (g[i] === s[i]) pattern[i] = 2;
        else counts[s[i]] = (counts[s[i]] || 0) + 1;
    }
    for (let i = 0; i < 5; i++) {
        if (pattern[i] === 0 && counts[g[i]] > 0) {
            pattern[i] = 1;
            counts[g[i]]--;
        }
    }
    return pattern.join("");
}

async function updateStatsAndSuggestions() {
    el.possibleCount.textContent = possibleWords.length;
    // Simple log base 3 calculation for min guesses
    const minG = possibleWords.length <= 1 ? possibleWords.length : Math.ceil(Math.log(possibleWords.length) / Math.log(3.5));
    el.minGuesses.textContent = possibleWords.length === 0 ? "0" : minG;
    await computeSuggestions();
}

async function computeSuggestions() {
    if (possibleWords.length === 0) {
        el.suggestions.innerHTML = "<li>No words possible</li>";
        return;
    }
    
    el.computing.classList.remove("hidden");
    await new Promise(r => setTimeout(r, 10)); // Allow UI to update

    const N = possibleWords.length;
    
    // STEP 1: Fast Letter Frequency Score
    // This stops the "Starts with A" bias by finding words with common letters first
    const freq = {};
    possibleWords.forEach(w => {
        const uniqueChars = new Set(w);
        uniqueChars.forEach(c => freq[c] = (freq[c] || 0) + 1);
    });

    const scoredPool = allGuesses.map(w => {
        let score = 0;
        const seen = new Set();
        for (const char of w) {
            if (!seen.has(char)) {
                score += (freq[char] || 0);
                seen.add(char);
            }
        }
        return { word: w, score };
    }).sort((a, b) => b.score - a.score);

    // STEP 2: Pick the top 200 high-frequency words + current possible words
    const candidates = Array.from(new Set([
        ...scoredPool.slice(0, 200).map(x => x.word),
        ...possibleWords.slice(0, 100)
    ]));

    // STEP 3: Heavy Entropy / Expected Remaining Math
    const results = [];
    for (const cand of candidates) {
        const patternCounts = new Map();
        for (const sol of possibleWords) {
            const p = getPattern(cand, sol);
            patternCounts.set(p, (patternCounts.get(p) || 0) + 1);
        }

        let entropy = 0, sumSq = 0;
        for (const count of patternCounts.values()) {
            const prob = count / N;
            entropy -= prob * Math.log2(prob);
            sumSq += count * count;
        }

        results.push({ 
            word: cand, 
            entropy, 
            expectedRemaining: sumSq / N,
            baseScore: scoredPool.find(x => x.word === cand)?.score || 0
        });
    }

    // STEP 4: Sort and Render
    if (currentSortKey === 'entropy') {
        results.sort((a, b) => b.entropy - a.entropy || a.expectedRemaining - b.expectedRemaining);
    } else if (currentSortKey === 'baseScore') {
        results.sort((a, b) => b.baseScore - a.baseScore);
    } else {
        results.sort((a, b) => a.expectedRemaining - b.expectedRemaining || b.entropy - a.entropy);
    }

    renderSuggestions(results.slice(0, 15));
    el.computing.classList.add("hidden");
}

function renderSuggestions(list) {
    el.suggestions.innerHTML = "";
    if (list.length > 0) el.expectedAfter.textContent = list[0].expectedRemaining.toFixed(1);

    list.forEach(item => {
        const li = document.createElement("li");
        li.innerHTML = `
            <div class="sugg-left">
                <span class="sugg-word">${item.word.toUpperCase()}</span>
                <span class="sugg-meta">E: ${item.entropy.toFixed(2)} | Rem: ${item.expectedRemaining.toFixed(1)}</span>
            </div>
            <button class="use-btn">Use</button>
        `;
        li.querySelector(".use-btn").onclick = () => {
            el.input.value = item.word;
            el.input.focus();
        };
        el.suggestions.appendChild(li);
    });

    if (possibleWords.length > 0 && possibleWords.length < 100) {
        el.possibleAnswersWrap.classList.remove("hidden");
        el.possibleAnswers.innerHTML = possibleWords.map(w => `<li>${w.toUpperCase()}</li>`).join("");
    } else {
        el.possibleAnswersWrap.classList.add("hidden");
    }
}

function onAddRow(word) {
    const guess = word.trim().toLowerCase();
    if (guess.length !== 5 || !allGuesses.includes(guess)) {
        alert("Not a valid 5-letter word.");
        return;
    }

    const rowCont = document.createElement("div");
    rowCont.className = "row-container";
    const row = document.createElement("div");
    row.className = "row";
    row.dataset.guess = guess;

    for (let i = 0; i < 5; i++) {
        const tile = document.createElement("div");
        tile.className = "tile state-0";
        tile.textContent = guess[i].toUpperCase();
        tile.dataset.state = "0";
        tile.onclick = () => {
            let s = (parseInt(tile.dataset.state) + 1) % 3;
            tile.dataset.state = s;
            tile.className = `tile state-${s}`;
        };
        row.appendChild(tile);
    }
    rowCont.appendChild(row);
    el.board.appendChild(rowCont);
    el.input.value = "";
}

function onApplyFeedback() {
    const rows = Array.from(el.board.querySelectorAll(".row"));
    let tempPossible = activeAnswerSet === 'answers' ? [...allAnswers] : [...allGuesses];

    rows.forEach(row => {
        const guess = row.dataset.guess;
        const pattern = Array.from(row.querySelectorAll(".tile")).map(t => t.dataset.state).join("");
        tempPossible = tempPossible.filter(sol => getPattern(guess, sol) === pattern);
    });

    possibleWords = tempPossible;
    updateStatsAndSuggestions();
}

function setSort(key) {
    currentSortKey = key;
    el.sortExp.classList.toggle("active-sort", key === 'expectedRemaining');
    el.sortEntropyBtn.classList.toggle("active-sort", key === 'entropy');
    el.sortScoreBtn.classList.toggle("active-sort", key === 'baseScore');
    computeSuggestions();
}

async function promptAnalyze() {
    const input = prompt("Enter guesses (e.g., CRANE SLOTH):");
    if (!input) return;
    const guesses = input.toLowerCase().split(/[\s,]+/).filter(w => w.length === 5);
    if (guesses.length === 0) return;
    
    const target = guesses[guesses.length - 1];
    el.board.innerHTML = "";
    possibleWords = activeAnswerSet === 'answers' ? [...allAnswers] : [...allGuesses];
    
    for (const g of guesses) {
        onAddRow(g);
        const lastRow = el.board.lastChild.querySelector(".row");
        const tiles = lastRow.querySelectorAll(".tile");
        const pattern = getPattern(g, target);
        pattern.split("").forEach((p, i) => {
            tiles[i].dataset.state = p;
            tiles[i].className = `tile state-${p}`;
        });
    }
    onApplyFeedback();
}
