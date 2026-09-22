# Transition Matrix — Risk Academy package

A self-contained teaching kit for the FSRM Academy coding series. It shows the
**risk audience** how the Transition Matrix workflow they already know moves from
**Excel to Python** — the code transformation, not the methodology.

Everything here runs on synthetic data that mirrors the real monthly extracts, so
it can be shared freely and run offline.

---

## What's in the box

### Notebooks

| File | Who | What |
|---|---|---|
| `Transition_Matrix_RISK_LIVE.ipynb` | **Hand to the risk audience** | Clean, runnable copy so they can follow along and run every step themselves. Also works as a take-home. |
| `Transition_Matrix_FACILITATOR.ipynb` | **You teach from this** | Everything in the risk copy **plus** grey *SAY / DO* talk-track boxes, timing, expected outputs and anticipated Q&A. A superset — what you demo matches their copy exactly. |
| `Transition_Matrix_FACILITATOR_PRERUN.ipynb` | Your backup | The facilitator notebook already executed, with every table embedded. Open this if something breaks live and keep talking. |
| `FACILITATOR_SCRIPT.md` | **Your speaking script** | The flowing talk track — timing, what to say, stage directions and Q&A, mapped to the notebook's 9-step flow. Explains each new bit of code as it appears. Read it beside the facilitator notebook. |

### Scripts

| File | What |
|---|---|
| `transition_matrix.py` | The whole workflow as eight clean, reusable functions — the "cheat sheet" version of what the notebook builds by hand. `import transition_matrix as tm`. |
| `generate_sample_data.py` | Creates the 60 synthetic monthly `.xlsx` extracts the notebooks run on. |
| `build_notebooks.py` | Source of truth for **both** notebooks. Edit content here, then rerun — never hand-edit the `.ipynb` files. |
| `requirements.txt` | The Python packages needed. |

The data lives in `../data/Transactional Data/` (shared with the rest of the
presentation folder). If you copy `risk_academy/` somewhere on its own, the setup
cell will generate its own `data/` folder automatically the first time it runs.

---

## Setup (once)

```bash
cd risk_academy
python -m pip install -r requirements.txt
```

In VS Code: open a notebook, click **Select Kernel** (top-right) → the Python 3.12
environment, then **Run All**. If the kernel list looks empty, reload the window
once (`Cmd+Shift+P` → *Developer: Reload Window*).

The Part 1 load cell reads 60 Excel files — it takes ~40 seconds. That is the one
slow cell; everything else is instant.

---

## Teaching it — the short version

1. **Audience owns the methodology.** Never explain what a transition matrix *is*.
   Explain the **Python** — walk each of the 9 steps as its own thing.
2. **Say the shape out loud** after every cell. `df.shape` on screen constantly.
   Every time you lose them, it's because they lost track of the shape.
3. **Pure walkthrough — no exercises.** You drive; the audience follows along and
   runs each cell in their own copy. The script explains each new bit of code
   (importing, variables, functions, loops, filters) the first time it appears,
   since they only did Python/pandas basics that same day.
4. ~65–70 minutes total. The full talk track is in `FACILITATOR_SCRIPT.md`; the
   notebook also carries short *SAY / DO* cues.

---

## After an edit

Change wording or code in **`build_notebooks.py`**, then rebuild both notebooks and
refresh the pre-run backup:

```bash
python build_notebooks.py
cp Transition_Matrix_FACILITATOR.ipynb Transition_Matrix_FACILITATOR_PRERUN.ipynb
python -m jupyter nbconvert --to notebook --execute --inplace \
    --ExecutePreprocessor.timeout=300 Transition_Matrix_FACILITATOR_PRERUN.ipynb
```

---

## Pointing it at real data

1. Set `DATA_ROOT` in the notebook's setup cell (or pass it to `tm.load_panel`) to
   the real archive folder — one sub-folder per year.
2. Make sure four columns are named `pn_number`, `loan_segment`, `report_date`,
   `dpd`; rename them at load time if the extract differs.
3. Run all cells. Nothing downstream changes.
