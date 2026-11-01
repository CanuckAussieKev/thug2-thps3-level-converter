# THUG2 THPS3 Level Converter

> **Not affiliated with or endorsed by Activision, Neversoft or any other rights holder.** A non-commercial fan project
> for preservation, interoperability and education. No game files are included: the tools work only on copies of the
> games you own. Game names are trademarks of their owners. See LICENSE (MIT for the project's own work; no licence for material
> from the games); third-party parts (downloaded tools) are listed in THIRD_PARTY_NOTICES.md. Rights holders: open an
> issue and it will be dealt with promptly.

Converts the career, classic and park levels of your THPS3 install, with their scripts, people and cars from your own copy of Tony Hawk's Pro Skater 3 (PC) to the formats of Tony Hawk's Underground 2 (PC), for its level
select. Nothing of either game is in this repository: the files are made from your copies each time. How it works,
what is converted and what isn't: [thps3_levels/README.md](thps3_levels/README.md).

- `thps3_levels/` - the converter (`thps3_levels.ts`: `convert`, `selfcheck`, `list` where it has one) and its tools.

It depends only on [thug2-level-converter-core](https://github.com/CanuckAussieKev/thug2-level-converter-core) (pinned
to a commit in package.json): THUG2's formats and what the converters share.

## Usage

Needs Node 24 and NeverScript's `ns.exe` (QB scripts compiled): the
[THUG2 decompilation](https://github.com/CanuckAussieKev/thug2-decomp) builds it (`tools\build_neverscript.ps1` ->
`out\neverscript\ns.exe`, found there when this converter is used inside it) - or pass `--ns <ns.exe>`.

    git clone https://github.com/CanuckAussieKev/thug2-thps3-level-converter
    cd thug2-thps3-level-converter
    npm install
    node thps3_levels/thps3_levels.ts convert Ware --thps3 "C:\Games\THPS3" --thug2 C:\Games\THUG2 --ns <ns.exe>
    node thps3_levels/thps3_levels.ts selfcheck --thug2 C:\Games\THUG2

`convert` writes `<thug2>\thug2-decomp-thps3\` (not read by the game); without level names it converts the default
set (thps3_levels/README.md). `--hd-textures` upscales the textures with Real-ESRGAN (optional: the content pipeline's `hd_textures/fetch.ts` downloads it). The [THUG2 content pipeline](https://github.com/CanuckAussieKev/thug2-content-pipeline)'s
`menu_level/make_menu_level.ts` then installs every converted game's levels into the game's data overlay and level
select. In the decomp, where the pipeline installs this converter, the same commands are

    node tools/pipeline/run.ts thps3_levels/thps3_levels.ts convert --thug2 C:\Games\THUG2
    node tools/pipeline/menu_level/make_menu_level.ts --game C:\Games\THUG2

Checks: `npm run typecheck`, `npm run lint`, `npm test` (the tests that need a game install skip without it).
