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
    const minG = possibleWords.length <= 1 ? 0 : Math.ceil(Math.log(possibleWords.length) / Math.log(3.5));
    el.minGuesses.textContent = possibleWords.length === 0 ? "0" : minG;
    await computeSuggestions();
}

function calcEntropyStats(word, pool) {
    const N = pool.length;
    if (N === 0) return { entropy: 0, expectedRemaining: 0 };
    const counts = new Map();
    for (const sol of pool) {
        const p = getPattern(word, sol);
        counts.set(p, (counts.get(p) || 0) + 1);
    }
    let entropy = 0, sumSq = 0;
    for (const count of counts.values()) {
        const prob = count / N;
        entropy -= prob * Math.log2(prob);
        sumSq += count * count;
    }
    return { entropy, expectedRemaining: sumSq / N };
}

async function computeSuggestions() {
    if (possibleWords.length === 0) {
        el.suggestions.innerHTML = "<li>No words possible</li>";
        return;
    }
    
    el.computing.classList.remove("hidden");
    await new Promise(r => setTimeout(r, 10));

    const N = possibleWords.length;
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

    const candidates = Array.from(new Set([
        ...scoredPool.slice(0, 200).map(x => x.word),
        ...possibleWords.slice(0, 100)
    ]));

    const results = [];
    for (const cand of candidates) {
        const stats = calcEntropyStats(cand, possibleWords);
        results.push({ 
            word: cand, 
            entropy: stats.entropy, 
            expectedRemaining: stats.expectedRemaining,
            baseScore: scoredPool.find(x => x.word === cand)?.score || 0
        });
    }

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

function onAddRow(word, analysisData = null) {
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

    if (analysisData) {
        const info = document.createElement("div");
        info.className = "analysis-label";
        const skillClass = analysisData.skill >= 98 ? 'skill-high' : '';
        info.innerHTML = `E: ${analysisData.ent.toFixed(2)}<br><span class="${skillClass}">${analysisData.skill}% Skill</span>`;
        rowCont.appendChild(info);
    }

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
    const input = prompt("Enter guesses (e.g., ADIEU CRANE):");
    if (!input) return;
    const guesses = input.toLowerCase().split(/[\s,]+/).filter(w => w.length === 5);
    if (guesses.length === 0) return;
    
    const target = guesses[guesses.length - 1];
    el.board.innerHTML = "";
    possibleWords = activeAnswerSet === 'answers' ? [...allAnswers] : [...allGuesses];
    
    let totalSkill = 0;

    for (const g of guesses) {
        if (possibleWords.length === 0) break;

        // Find the absolute max entropy for skill comparison
        // We evaluate a larger sample for the analyzer to ensure accuracy
        const sampleSize = 150;
        const freq = {};
        possibleWords.forEach(w => {
            const uniqueChars = new Set(w);
            uniqueChars.forEach(c => freq[c] = (freq[c] || 0) + 1);
        });
        const analyzerPool = allGuesses.map(w => {
            let score = 0;
            const seen = new Set();
            for (const char of w) { if (!seen.has(char)) { score += (freq[char] || 0); seen.add(char); } }
            return { word: w, score };
        }).sort((a, b) => b.score - a.score).slice(0, sampleSize).map(x => x.word);
        
        // Ensure words in the current possible set are also considered
        const comparisonCandidates = Array.from(new Set([...analyzerPool, ...possibleWords.slice(0, 50)]));
        
        let maxEnt = 0;
        comparisonCandidates.forEach(w => {
            const ent = calcEntropyStats(w, possibleWords).entropy;
            if (ent > maxEnt) maxEnt = ent;
        });

        const currentStats = calcEntropyStats(g, possibleWords);
        
        // Precision check: If entropy is very close to max, treat as 100%
        // Otherwise, use a rounded ratio
        let skill = 0;
        if (maxEnt === 0) {
            skill = 100;
        } else {
            const ratio = currentStats.entropy / maxEnt;
            skill = ratio > 0.999 ? 100 : Math.floor(ratio * 100);
        }
        
        totalSkill += skill;

        onAddRow(g, { ent: currentStats.entropy, skill: skill });

        const lastRow = el.board.lastChild.querySelector(".row");
        const tiles = lastRow.querySelectorAll(".tile");
        const pattern = getPattern(g, target);
        
        pattern.split("").forEach((p, i) => {
            tiles[i].dataset.state = p;
            tiles[i].className = `tile state-${p}`;
        });

        possibleWords = possibleWords.filter(sol => getPattern(g, sol) === pattern);
    }

    el.avgSkill.textContent = Math.round(totalSkill / guesses.length) + "%";
    updateStatsAndSuggestions();
}
