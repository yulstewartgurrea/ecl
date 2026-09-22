# Facilitator script — Transition Matrix in Python

**FSRM Academy · Coding Series · your segment (~65–70 min)**

A step-by-step talk track written for a room that only learned **Python basics and
pandas basics this same day** — so it explains each new bit of code the first time
it shows up (what importing is, what a variable is, what a function does, and so on).
Say it in your own words; this is a guide, not a read-out.

- *(run)* = run that cell.
- **[⏱]** = rough timing — go slower if the room is new to code.
- You're teaching the **code**. If a risk question comes up, hand it back to the
  room. This session is the **Transition Matrix** only; net flow rate, ECL and the
  rest are your colleagues' sessions.

---

## Before you start

- [ ] Kernel → Restart. Run **Setup** and the **consolidation read cell** now (that
      one's the slow ~40s step).
- [ ] Bump the editor font up two sizes.
- [ ] Keep `Transition_Matrix_FACILITATOR_PRERUN.ipynb` open in another tab (backup).
- [ ] Make sure the audience has their own copy (`Transition_Matrix_RISK_LIVE.ipynb`)
      open so they can run along.

---

## Opening — [⏱ 0–3]

"In this sample session, I'll walk through the Transition Matrix in Python — the same
process you know, built step by step from the raw data. You just did Python and
pandas basics this morning, so as we go I'll explain each new piece of code the first
time it comes up. Nothing here is more advanced than what you've already seen — it's
the same building blocks, just put together."

*(show the steps cell)* "Here's the whole path: consolidate the files, reshape them,
bucket the days-past-due, apply everbad, then build the matrix, project it forward,
and read off the PD. For each step I'll say what it does, then we'll run it and look
at the result together."

"One heads-up on the numbers: we're using sample data, so the final PD comes out
around 7.6%, not the ~11.64% you'd get on the real portfolio. Same steps — the sample
just has a gentler downturn."

---

## Setup — [⏱ 3–6]

"Almost every Python script starts the same way: before you can use a tool, you have
to **bring it in** — that's what *importing* is."

"We import just **one** library today — **pandas**, the one you learned this morning.
It does everything we need: the data, the maths, and the tables. The `as pd` just
gives it a short nickname so we don't type the full name every time; `pd` is pandas'
nickname by convention. (`Path` is from Python itself, only to find the files.)"
*(run Step 1)*

"Next, Python needs to know **where our data lives**. We store that folder location
in a **variable** — a variable is a name that stores a value so you can reuse it by
name later. I'm calling it `DATA_ROOT`. The capital letters are just a habit for
something we won't change — but the name is your choice, it could be anything. From
now on, whenever we type `DATA_ROOT`, Python knows we mean that folder."
*(run Step 2 — show the path it printed)*

---

## The input data — [⏱ 6–8]

"Our starting point is 5 years of monthly transactional extracts — one file per
month, 60 of them, each a month-end snapshot of the loan book. We assume they're
already cleaned and consistently named."

"Let's open one file to see it. `pd.read_excel` takes an Excel file and turns it into
a **DataFrame** — that's pandas' word for a table, rows and columns. And `.head()`
just shows the first few rows so we can eyeball it." *(run — point out the columns)*
"Four of these do the real work later: `pn_number`, `loan_segment`, `report_date`,
`dpd`."

---

## 1 · Consolidate the files — [⏱ 8–14]

"First we bring all 60 files together into one dataset. Three small steps."

"First, we need the **list** of files to read. A list is just an ordered collection of
things — here, file names. `glob` finds files matching a pattern, and the `*` is a
wildcard meaning 'anything goes here.' So this line finds every monthly file and
remembers them in a variable called `files`." *(run Step 1 — 'found 60')*

"Now let's read them all in. We **loop** over the files — for each one, read it into a
table and add it to a list — and print progress every 10 files so we can see it
ticking along. This is the slow step, about 40 seconds, so let me start it and keep
talking." *(run Step 2)* "…there go the progress lines, and one file is about a
thousand rows."

"Last, let's glue those 60 tables into one. `concat` — short for concatenate — stacks
them on top of each other into a single big table. `ignore_index=True` just renumbers
the rows straight through instead of each file restarting at 0." *(run Step 3, show
the head)* "About sixty thousand rows now — roughly 60 times a thousand, which tells
me nothing got dropped."

---

## Data validation — [⏱ 14–18]

"We're *assuming* the data is clean, but before we build anything on it, it's good
practice to actually check. I'll explain the code as we go because there's a new idea
here."

"First we **write our own tool** — a *function*. A function is a reusable block of
code you give a name, so you can run it whenever you like just by calling its name.
You create one with the word `def`. Ours is called `validate_transactional_data`, and
it takes in a table and checks four things: are the columns we need there, any
duplicate columns, do the dates and DPD read as a real date and a real number, and is
any column more than 10% blank." *(run Step 1 — the function)* "Notice nothing
happened when we ran that — defining a function just tells Python the steps; it
doesn't run them until we call it."

"Now let's actually **use** it — we *call* the function by name and hand it our data."
*(run Step 2)* "It says PASSED — so we're good. If it failed, it'd list exactly what's
wrong, and we'd fix the data before going on."

"Since it passed, the last bit: we make sure our two key columns are the right type.
`to_datetime` turns the report date into a proper date, and `to_numeric` turns DPD
into a proper number. Then we're ready to reshape." *(run Step 3)*

---

## 2 · Pivot to a loan × month grid — [⏱ 18–23]

"Right now the data is *long* — one row per loan per month. To see a loan *move*, we
reshape it *wide*: one row per loan, one column per month, DPD in the cells. pandas
has a tool for exactly that, `pivot_table`, and it asks you four things: what goes
down the side (`index`), what goes across the top (`columns`), what fills the cells
(`values`), and what to do if two values land in one spot (`aggfunc`)."

"Let's run it." *(run Step 1)* "Watch the shape at the bottom — sixty thousand rows
just became about two thousand. Same data, but now it's one row per loan, which is
what lets us see a loan move across the months."

"Now let's tidy the month labels so they read as plain dates and sit in order."
*(run Step 2)*

"One thing to point out — a lot of blank cells. A blank just means the loan wasn't on
the book that month. Let's count how many that is, so you see it's normal, not an
error." *(run the on-book/not-on-book cell)*

---

## 3 · Bucket the DPD — [⏱ 23–29]

"Next we turn the raw day count into a bucket, 0 to 4, using the standard bands. We
write the rule once as a small function — same idea as the validation function
earlier, `def` and a name."

"Let's read it together. It uses `if` / `elif` — 'if it's this, return that; otherwise
check the next.' A blank stays blank, and the order of the checks matters." *(run the
function cell)* "See how each check only sees what got past the one above it — so once
we're at the `<= 60` line, we already know it's over 30. If you put the 90 check
first, everything from 1 to 90 would fall into bucket 3 — and it wouldn't error, it'd
just be quietly wrong, which is worse."

"Now we apply that function to the whole grid. `.apply` is a pandas tool that runs
your function on every single value in a column — so we don't write a loop ourselves,
it does it for us." *(run the apply cell)*

---

## 4 · Apply the everbad rule — [⏱ 29–35]

"Everbad — once an account is bad (bucket 4), it stays bad. In the raw data loans can
recover out of default; this rule ignores those recoveries. Here we use a **loop** —
code that repeats. This is the one place today where a loop is the natural tool,
because each month depends on the one before it: we go across each account's row, left
to right, and we *remember* whether we've already seen a default, using a simple
True/False variable."

"Let's run it." *(run the loop)* "The moment it hits a 4, it sets everything after to 4
as well."

"And let's see how many cells that changed." *(run the impact cell)* *(if someone asks
why we do this, hand it to the room: "you'll know the reasoning better than me.")*

---

## 5 · Observed default rate (ODR) — [⏱ 35–41]

"Now the observed default rate, straight from the data: of the good accounts at a
point in time, how many went bad within a year, divided by the total good at the
start. It uses an idea worth naming: a **boolean mask**. When you compare a whole
column — like `buckets == 4` — you don't get one answer, you get a True/False for
every row. Add those Trues up with `.sum()` and you've counted them. That's
counting-with-a-condition."

"Let's do one first, by hand — good in Jan 2021, how many bad by Jan 2022, then
divide. `.isin([0,1,2,3])` is a handy one — it asks 'is this value one of these?' — so
it marks the good accounts. The one thing to watch is the bottom of the fraction: it's
the good ones at the *start*." *(run the one-ODR cell)*

"Now let's run it for every month to get the whole series — we'll use this again at
the end." *(run the full-series cell)*

---

## 6 · Build the transition matrix — [⏱ 41–51] · *the main one, take it slow*

"This is the core, and it's three moves: count, turn into percentages, then average.
Let's do them one at a time."

"First, the **count** — for one pair of months, how many accounts went from each
bucket to each bucket. The last two columns are *Indeterminate* — the ones that left
the book — and *Total Accounts Evaluated*, the row total without them." *(run the Count
cell)*

"Next, turn those counts into **percentages** — each one divided by its row total.
Point out that every row adds up to 100% — an account has to end up somewhere, so
that's our quick check that it's right." *(run the Percentage cell)*

"Last, the **average**. We've got one of these grids for every pair of months. We
`concat` them into one tall stack, then `groupby` the row label and take the mean —
which conveniently skips any month where a bucket was empty. That's our average
transition matrix." *(run the Average cell)*

---

## 7 · Project forward (Markov) — [⏱ 51–55]

"The matrix so far covers one month; we need twelve. So we multiply the average matrix
by itself twelve times. pandas multiplies two matrices with `.dot()`, so we just call
`.dot()` in a short loop." *(run the projection cell)*

*(optional — run the month-by-month table if you have time; skip if behind)*

"Quick caveat you can mention in your own words: it assumes each month behaves about
the same. You'll explain that side better than me."

---

## 8 · Through-the-Cycle PD — [⏱ 55–58]

"The answer is almost anticlimactic: it's just the last column of that 12-step matrix
— the default column, labelled `91+ DPD`. In code, `twelve["91+ DPD"]` pulls that one
column out." *(run the table)* "One PD per bucket — and **this table is the end output
of the whole session**. On the real portfolio these are 11.64, 37.83, 48.87, 75.67,
100. Lower here because of the sample data, but they climb the same way — the further
behind an account is today, the higher its one-year PD."

---

## 9 · Compare against actual defaults — [⏱ 58–62]

"Last step — a quick reality check, no chart needed. We just compare the numbers: the
model's bucket-0 PD against the average of the observed default rate we built earlier."
*(run the comparison cell)* "The model's number sits near that average — it's a
through-the-cycle figure, so it lands in the middle rather than following any one year."

---

## Close + Q&A — [⏱ 62–67]

"So that's the whole Transition Matrix — start to finish — in code you can read top to
bottom. Every one of those was built from the same basics you learned this morning:
importing tools, variables, a couple of functions, one loop, and filtering. It's all
bundled in a file called `transition_matrix.py` too, so you can run it on your own
data."

"This is where my part stops — the next pieces, net flow rate and ECL, my colleagues
will take you through."

### Q&A you'll get

- **"Why 7.6% here but 11.64% on ours?"** → Different data — sample vs real. Same
  steps.
- **"Can it read our real files?"** → Yes — point `DATA_ROOT` at the archive, keep
  the four column names.
- **"Can we do it per segment?"** → Yes — filter by `loan_segment` first, then the
  same steps. Happy to show it after.

**If someone corrects your risk wording:** take it and say thanks — you're the tech
person, getting the methodology from the room is exactly right.

---

### Cheat sheet — one line per step

| Step | Cells to run | One line to say |
|---|---|---|
| Setup | import pandas, then `DATA_ROOT` | one library — pandas; put the data path in a variable |
| Input | peek one file | read_excel turns an Excel file into a table (DataFrame) |
| 1 · Consolidate | list → read → stack | list the files, read each, concat into one |
| Validation | write checks → run → set types | a function that checks the data is clean |
| 2 · Pivot | pivot → tidy → count blanks | pivot_table: one row per loan, months across |
| 3 · Bucket | function → apply | a function maps day count → bucket; apply runs it on all |
| 4 · Everbad | loop → impact | a loop that remembers: once bad, stay bad |
| 5 · ODR | one ODR → full series | True/False masks + `.sum()` = counting with a condition |
| 6 · Matrix | count → % → average | `concat` + `groupby().mean()` averages the grids |
| 7 · Markov | projection cell | `.dot()` in a loop = multiply by itself 12 times |
| 8 · TTC PD | table | `twelve["91+ DPD"]` = last column = the PD (the output) |
| 9 · Compare | numbers | model PD vs the average observed rate |

**Real portfolio PD:** 0 DPD **11.64%** · 1–30 **37.83%** · 31–60 **48.87%** · 61–90
**75.67%** · 91+ **100%**.
