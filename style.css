:root {
    --bg: #121213;
    --panel: #1a1a1b;
    --text: #ffffff;
    --muted: #9b9b9b;
    --tile-size: 56px;
    --accent-green: #6aaa64;
    --accent-yellow: #c9b458;
    --accent-gray: #3a3a3c;
    --accent-blue: #3b82f6;
    --accent-purple: #8b5cf6;
}

* { box-sizing: border-box; }

body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: Inter, system-ui, -apple-system, sans-serif;
    display: flex;
    justify-content: center;
}

main {
    width: 100%;
    max-width: 980px;
    padding: 24px;
}

.controls {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 20px;
    flex-wrap: wrap;
}

.controls input {
    padding: 10px;
    font-size: 16px;
    border-radius: 6px;
    border: 1px solid var(--accent-gray);
    background: var(--panel);
    color: var(--text);
    text-transform: uppercase;
}

.controls button {
    background: var(--panel);
    border: 1px solid var(--muted);
    border-radius: 6px;
    padding: 8px 12px;
    color: var(--text);
    cursor: pointer;
    font-weight: 600;
}

.btn-blue { background: var(--accent-blue) !important; border-color: var(--accent-blue) !important; }
.btn-purple { background: var(--accent-purple) !important; border-color: var(--accent-purple) !important; }

#board {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 24px;
    align-items: center;
}

.row-container {
    display: flex;
    align-items: center;
    gap: 20px;
}

.row {
    display: grid;
    grid-template-columns: repeat(5, var(--tile-size));
    gap: 8px;
}

.analysis-label {
    width: 150px;
    font-size: 13px;
    color: var(--muted);
    line-height: 1.2;
}

.skill-high { color: var(--accent-green); font-weight: bold; }

.tile {
    width: var(--tile-size);
    height: var(--tile-size);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 22px;
    border-radius: 4px;
    border: 2px solid var(--accent-gray);
    cursor: pointer;
    text-transform: uppercase;
    transition: background 0.2s;
}

.state-0 { background: var(--accent-gray); border-color: var(--accent-gray); }
.state-1 { background: var(--accent-yellow); color: #000; border-color: var(--accent-yellow); }
.state-2 { background: var(--accent-green); border-color: var(--accent-green); }

#info { display: flex; gap: 16px; flex-wrap: wrap; }
#stats, #suggestionsWrap, #possibleAnswersWrap {
    background: var(--panel);
    padding: 16px;
    border-radius: 12px;
    flex: 1 1 300px;
}

.stat-item { margin-bottom: 8px; }

.header-flex {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
}

.sort-controls button {
    padding: 4px 8px;
    font-size: 11px;
    background: var(--bg);
    border: 1px solid var(--accent-gray);
    color: var(--text);
    cursor: pointer;
}

.sort-controls button.active-sort {
    background: var(--accent-yellow);
    color: #000;
}

#suggestions li {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid #2a2a2b;
}

.sugg-word { font-weight: bold; font-size: 16px; }
.sugg-meta { font-size: 12px; color: var(--muted); }

.hidden { display: none !important; }
