<p align="center">
  <img src="docs/assets/atlas-mark.svg" alt="" width="96" height="96">
</p>
<h1 align="center">AITP Atlas</h1>
<p align="center"><strong>A workbench for theoretical physics in DeepSeek Harness</strong></p>
<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#working-with-aitp">Working with AITP</a> ·
  <a href="docs/guide.md">User guide</a> ·
  <a href="DESIGN.md">Design</a>
</p>

Atlas is built to serve research and the search for truth in physics. A derivation should lead back to its assumptions, and a numerical result to the calculation that produced it. A failed check or an unresolved objection belongs in the record when it changes what we can claim. Atlas keeps the question, its evidence and the discussion within reach as the work develops.

## Preview the redesigned Desk and discussions (0.11.0 review branch)

From this source checkout with a compatible local DSH runtime, run `node build-client.mjs` then `npm run preview`. Open the **exact private URL** printed by the launcher and select **Atlas** in the DSH sidebar. This opens a disposable research programme and a local streaming mock model, not your profile or research. Press `q` then Enter in the terminal to discard it. Rebuild and restart the preview after editing the plugin.

Start on **Desk** to draft a question. **Auto** suggests topics; a weak match stays unfiled. Select **Atlas ▾ → Discussions** (or **Alt+2**) for research discussions, filters and filing. A tab is already-open content; **Atlas ▾** opens a destination, and DSH keeps its own sidebar. Try two discussions side by side, or move one to a topic and undo before its six-second notification window ends. The native research-team launcher is scheduled for M3. See the [M2 review and limitations](design/1.0/reports/M2.md) and [navigation comparison](design/1.0/reports/nav/nav-comparison-final.png).

The installation instructions and [user guide](docs/guide.md) below describe the released 0.9.2 baseline; this review build does not require installing it.

## A research session in Atlas

- **Find the open question.** Universe maps the research programme, its topics and branches. Activity shows what is running and which decisions need the researcher's judgment.
- **Read beside the work.** Open manuscripts, PDFs, code and figures at the cited section, page or line. Discover papers through arXiv and INSPIRE, and preserve the edition and provenance when adding a paper to the library.
- **Work through the argument.** Select a passage to discuss, derive or check it in a DSH session beside the source. Use a separate review to check consequential claims, and review the changes made to the research notes.
- **Keep what the evidence supports.** Link the resulting argument to its derivation, sources or calculation from the owning `research.md`. When it is time to write, edit LaTeX alongside its compiled PDF.

## Working with AITP

[AITP Research Protocol](https://github.com/bhjia-phys/AITP-Research-Protocol) defines the research cycle and the Skills that guide it. Its root, topic and branch `research.md` files carry the developing scientific argument, and `Current work` records where to resume. **Atlas** opens those same files as an interactive workspace. **DeepSeek Harness** runs the AI sessions and tools.

When you ask about a passage, Atlas sends the topic, file, section or PDF page and selected text into the DSH discussion. AITP's `aitp-memory` Skill then guides the agent through the relevant notes and evidence. Atlas renders the resulting files directly, so the same research can be continued from any editor or agent that can read the workspace. [AITP's research cycle](https://github.com/bhjia-phys/AITP-Research-Protocol#a-topic-is-a-living-research-note)

## Quick start

1. **Install Atlas and AITP Skills together** in DeepSeek Harness 0.2.2 or a later compatible 0.2.x version. If you use DSH Desktop, open it once to create its profile and then fully quit it. Run the installer below with Node.js 22 or later. It adds both bundles to the same DSH profile. From a source checkout, run `npm pack` to build the Atlas `.tgz` and use `scripts/install-dsh.mjs` as the installer path.
2. **Point Atlas at your research folder.** Add the following entry to the profile's `cordis.patch.yml` and restart DSH. Set `root` to an existing folder on the DSH host. See the [installation guide](docs/guide.md#install) for Windows and WSL paths and shared-library settings.
3. **Open Atlas** from the sidebar. An existing `research.md` opens directly. For an empty folder, use **Initialize workspace**, then **Start a research topic**. The discussion can use the installed AITP Skills to get started.

```sh
node install-dsh.mjs desktop ./aitp-atlas-0.9.2.tgz
```

```yaml
- id: aitp-atlas
  name: aitp-atlas
  config:
    root: /path/to/research
```

See the [user guide](docs/guide.md) for reading, LaTeX, teams and review. The [design notes](DESIGN.md) explain the relationship between Atlas, the research files and the DSH host. [MIT license](LICENSE)
