# Third-party code and data

This repository (THUG2 THPS3 Level Converter, MIT - LICENSE) uses or downloads the following. Their licences
apply to those parts. The code it shares with the other converters is
[thug2-level-converter-core](https://github.com/CanuckAussieKev/thug2-level-converter-core) (its own
THIRD_PARTY_NOTICES.md).

| Component | Where | Licence |
|---|---|---|
| NeverScript (byxor; THUG2 fork by violetvandal) - https://github.com/violetvandal/NeverScript | **not in this repository**: the converter runs the `ns.exe` the THUG2 decomp builds (its `tools\build_neverscript.ps1` downloads it) | no licence; its author's permission - the decomp's THIRD_PARTY_NOTICES.md |
| Real-ESRGAN v0.2.5.0 (Xintao Wang et al.) - https://github.com/xinntao/Real-ESRGAN: its Windows build of realesrgan-ncnn-vulkan with the models realesrgan-x4plus and realesrgan-x4plus-anime | **not in this repository**: downloaded on request by the content pipeline's `hd_textures/fetch.ts`, run by `--hd-textures` (thug2-level-converter-core's `level_port/hd_textures.ts`). Only the textures it makes (from your own game files) end up in the output | BSD 3-clause - https://github.com/xinntao/Real-ESRGAN/blob/master/LICENSE (the ncnn front end: MIT; Tencent ncnn: BSD 3-clause) |
