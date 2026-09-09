# BeeUI external-consumer validation matrix

> Canonical BeeECOM tracker for validating BeeUI from a real external application.
>
> BeeUI authority: `development`; public component inventory derived from `registry/registry.json`, `packages/ui/src/index.ts` and generated `llms-components.txt`.
> BeeECOM package baseline: `@beemvp/beeui-* 0.86.2-rc.1` unless a row says otherwise.

## Status

| Status | Meaning |
| --- | --- |
| ✅ VERIFIED | Direct evidence exists for every evidence class required by the row. |
| 🟡 PARTIAL | Some evidence exists, but the contract is not fully proved. |
| 🧪 IN PROGRESS | Active validation is underway. |
| 🚨 MISMATCH | Docs, LLM guidance, public API/type surface or runtime disagree. |
| 🔧 CONSUMER FIXED | BeeECOM usage was wrong; BeeUI contract was coherent and BeeECOM was corrected. |
| ⬜ NOT CHECKED | No BeeECOM-specific validation yet. |
| ⛔ BLOCKED | Honest validation cannot complete until an upstream/dependency blocker is resolved. |

## Evidence classes

`PKG` package boundary · `TYPE` strict TypeScript · `BUILD-WEB` production Web build · `BUILD-IOS` iOS bundle/compile · `BUILD-ANDROID` Android bundle/compile · `WEB-RUNTIME` real browser · `IOS-RUNTIME` simulator/device · `ANDROID-RUNTIME` emulator/device · `A11Y` accessibility evidence · `RESP` responsive/reflow · `VISUAL` visual evidence · `DOC` human docs · `LLM` machine/agent guidance · `SOURCE` BeeUI source/public contract.

---

# L0 — Product capability matrix

| ID | Capability | Status | Evidence now | Next / gap | BeeUI ref |
| --- | --- | --- | --- | --- | --- |
| P01 | npm RC distribution / external package consumption | 🚨 MISMATCH | `PKG TYPE BUILD-WEB BUILD-IOS BUILD-ANDROID DOC LLM` | RC works, but generated docs/LLM still say unpublished | [#543](https://github.com/beobungbu/BeeUI/issues/543) |
| P02 | React / RN / RN Web compatibility | 🟡 PARTIAL | `TYPE BUILD-WEB BUILD-IOS BUILD-ANDROID` | Runtime parity + dependency drift | — |
| P03 | Expo SDK 57 consumer compatibility | 🚨 MISMATCH | `PKG BUILD-WEB BUILD-IOS BUILD-ANDROID` | Canonical `@expo/metro-runtime` peer pin drifts | [#544](https://github.com/beobungbu/BeeUI/issues/544) |
| P04 | Vite + React Native Web integration | ✅ VERIFIED | `SOURCE DOC TYPE BUILD-WEB WEB-RUNTIME` | Recheck pinned `vite-plugin-rnw@0.0.12` before a Vite 9 bump; Vite 8 currently emits the known future-deprecation warning | — |
| P05 | Application-root provider runtime | 🔧 CONSUMER FIXED | `SOURCE DOC TYPE` + all builds + Toast `WEB-RUNTIME` | Keep one root provider; add modal/anchored-overlay/native provider runtime evidence | — |
| P06 | Safe-area ownership | 🚨 MISMATCH | `SOURCE DOC BUILD-IOS BUILD-ANDROID` | Native notch/home-indicator runtime; Web docs disagree | [#547](https://github.com/beobungbu/BeeUI/issues/547) |
| P07 | Global System / Light / Dark preference | 🚨 MISMATCH | `TYPE` + all builds + `WEB-RUNTIME VISUAL DOC LLM SOURCE` | Native OS-switch runtime; branded System semantics | [#545](https://github.com/beobungbu/BeeUI/issues/545) |
| P08 | Scoped theme / BeeThemeScope | ⬜ NOT CHECKED | — | Add scoped brand/theme consumer fixture | — |
| P09 | Semantic tokens / theme CSS | 🟡 PARTIAL | `PKG TYPE SOURCE` + all builds | Full color/type/spacing/motion/runtime-override coverage | — |
| P10 | Responsive / layout / breakpoints | 🟡 PARTIAL | all builds + partial `RESP` | Formal viewport, zoom, landscape, tablet, large-text matrix | — |
| P11 | Accessibility system | 🟡 PARTIAL | `A11Y WEB-RUNTIME TYPE` now includes Select keyboard/focus and Toast live region | Per-component names/states + native assistive tech; Table bridge still mismatches | [#546](https://github.com/beobungbu/BeeUI/issues/546) |
| P12 | Forms / selection | 🟡 PARTIAL | Input + Select: `TYPE SOURCE DOC` + all builds; Select `WEB-RUNTIME` keyboard/typeahead/focus | Validation composition + native Input/Select runtime | — |
| P13 | Anchored overlays | 🟡 PARTIAL | Select: all builds + `WEB-RUNTIME` keyboard dismissal/typeahead/collision containment | Native runtime; Popover/Menu/Tooltip still unused | — |
| P14 | Modal overlays / Sheet | ⬜ NOT CHECKED | — | Dialog/AlertDialog/Sheet realistic flows | — |
| P15 | Data display / Table | 🚨 MISMATCH | `TYPE BUILD-WEB SOURCE DOC WEB-RUNTIME`; real HTML table/header/body semantics pass | Web accessibility prop bridge + stacked/sort/selection/native runtime | [#546](https://github.com/beobungbu/BeeUI/issues/546) |
| P16 | Feedback / status / loading | 🟡 PARTIAL | Badge/Card/Text all builds; Toast `TYPE BUILD-WEB BUILD-IOS BUILD-ANDROID WEB-RUNTIME A11Y` | Toast FIFO/action/persistent/native runtime; Spinner/Skeleton/StateMessage | — |
| P17 | Date/time | ⬜ NOT CHECKED | — | Calendar + native picker flows | — |
| P18 | Navigation/content primitives | ⬜ NOT CHECKED | — | Tabs/Breadcrumb/Pagination/List/Stepper/Timeline/Link | — |
| P19 | Source-ownership CLI / Registry | ⬜ NOT CHECKED | — | Independent `beeui add`, doctor, diff, update | — |
| P20 | Human documentation truth | 🚨 MISMATCH | `DOC SOURCE` + consumer reproduction | Continue component-by-component audit | [#543](https://github.com/beobungbu/BeeUI/issues/543), [#547](https://github.com/beobungbu/BeeUI/issues/547) |
| P21 | LLM / agent guidance truth | 🚨 MISMATCH | `LLM SOURCE` + consumer reproduction | Publication and System-theme guidance currently drift | [#543](https://github.com/beobungbu/BeeUI/issues/543), [#545](https://github.com/beobungbu/BeeUI/issues/545) |
| P22 | Full public component surface | 🧪 IN PROGRESS | **62/62 public modules inventoried below** | Exercise every relevant family or explicitly classify out-of-scope | [#473](https://github.com/beobungbu/BeeUI/issues/473) |

---

# L1 — Complete 62-module public component matrix

“Used” only means BeeECOM currently imports/exercises the family. It does **not** mean fully verified.

## Layout / shell / structure — 10

| # | Module | Public family | Used | Status | Evidence / next | Issue |
| ---: | --- | --- | ---: | --- | --- | --- |
| 1 | `app-header` | AppHeader | No | ⬜ | layout + large text + safe area | — |
| 2 | `bottom-action-bar` | BottomActionBar | No | ⬜ | bottom inset + keyboard + large text | — |
| 3 | `box` | Box | Yes | 🟡 | `TYPE`, all builds; stress responsive/large text | — |
| 4 | `card` | Card | Yes | 🟡 | `TYPE`, all builds; variants/high contrast | — |
| 5 | `keyboard-aware-screen` | KeyboardAwareScreen | No | ⬜ | iOS/Android keyboard runtime | — |
| 6 | `safe-area` | BeeUIProvider, SafeArea | Yes | 🚨 | source/docs/all builds; native runtime + Web docs conflict | [#547](https://github.com/beobungbu/BeeUI/issues/547) |
| 7 | `screen` | Screen | Yes | 🟡 | `TYPE SOURCE DOC`, all builds | — |
| 8 | `section` | Section | No | ⬜ | responsive/content semantics | — |
| 9 | `separator` | Separator | No | ⬜ | orientation/semantics/high contrast | — |
| 10 | `stack` | Stack, HStack, VStack | No | ⬜ | wrapping/spacing/responsive | — |

## Actions / navigation — 7

| # | Module | Public family | Used | Status | Evidence / next | Issue |
| ---: | --- | --- | ---: | --- | --- | --- |
| 11 | `button` | Button, ButtonLabel | Yes | 🟡 | all builds + browser interaction; loading/disabled/keyboard/native runtime | — |
| 12 | `icon-button` | IconButton | No | ⬜ | accessible name + touch target | — |
| 13 | `link` | Link | No | ⬜ | Web/native navigation semantics | — |
| 14 | `breadcrumb` | Breadcrumb, BreadcrumbItem | No | ⬜ | semantics/overflow/RTL | — |
| 15 | `pagination` | Pagination, PaginationItem | No | ⬜ | keyboard/dynamic type/compact viewport | — |
| 16 | `tabs` | Tabs family | No | ⬜ | controlled state/keyboard/focus/native semantics | — |
| 17 | `stepper` | Stepper, StepperItem | No | ⬜ | state/a11y/overflow | — |

## Forms / selection — 14

| # | Module | Public family | Used | Status | Evidence / next | Issue |
| ---: | --- | --- | ---: | --- | --- | --- |
| 18 | `field` | Field | No | ⬜ | label/description/error association | — |
| 19 | `form-group` | FormGroup | No | ⬜ | grouped semantics/spacing | — |
| 20 | `form-message` | FormMessage, HelperText | No | ⬜ | error/status announcements | — |
| 21 | `input` | Input | Yes | 🟡 | `TYPE SOURCE DOC`, all builds; Field + invalid/disabled/runtime | — |
| 22 | `label` | Label | No | ⬜ | Web/native association + required/disabled composition | — |
| 23 | `textarea` | Textarea | No | ⬜ | multiline/resize/keyboard/large text | — |
| 24 | `search-input` | SearchInput | No | ⬜ | clear/search semantics + keyboard | — |
| 25 | `password-input` | PasswordInput | No | ⬜ | reveal/secure-entry/accessibility | — |
| 26 | `otp-input` | OTPInput | No | ⬜ | autofill/paste/focus/screen reader | — |
| 27 | `checkbox` | Checkbox | No | ⬜ | controlled/mixed/native-Web a11y | — |
| 28 | `radio` | Radio, RadioGroup | No | ⬜ | arrows/group semantics/native parity | — |
| 29 | `switch` | Switch | No | ⬜ | state/native semantics/disabled | — |
| 30 | `segmented-control` | SegmentedControl family | No | ⬜ | keyboard/native semantics/overflow | — |
| 31 | `select` | Select family | Yes | 🟡 | `TYPE SOURCE DOC`, all builds + `WEB-RUNTIME`: keyboard/typeahead/Enter/Escape/focus restore + constrained collision; native runtime remains | — |

## Overlay / modal / transient — 7

| # | Module | Public family | Used | Status | Evidence / next | Issue |
| ---: | --- | --- | ---: | --- | --- | --- |
| 32 | `dialog` | Dialog family | No | ⬜ | trap/restore/Escape/back/native modal | — |
| 33 | `alert-dialog` | AlertDialog family | No | ⬜ | destructive-confirm semantics/focus | — |
| 34 | `popover` | Popover family | No | ⬜ | geometry/collision/dismiss | — |
| 35 | `dropdown-menu` | DropdownMenu family | No | ⬜ | keyboard/typeahead/menu state | — |
| 36 | `sheet` | Sheet family | No | ⬜ | native gesture providers/snap/dismiss/keyboard/a11y | — |
| 37 | `tooltip` | Tooltip family | No | ⬜ | hover/focus/long-press/timing/a11y | — |
| 38 | `toast` | useToast | Yes | 🟡 | all builds + `WEB-RUNTIME A11Y`: provider-scoped success Toast and `aria-live`; FIFO/action/persistent/safe-area/native remain | — |

## Data display / status / content — 19

| # | Module | Public family | Used | Status | Evidence / next | Issue |
| ---: | --- | --- | ---: | --- | --- | --- |
| 39 | `accordion` | Accordion family | No | ⬜ | keyboard/expanded/large text | — |
| 40 | `alert-banner` | AlertBanner | No | ⬜ | status semantics/action/wrapping | — |
| 41 | `avatar` | Avatar | No | ⬜ | fallback/image semantics/sizing | — |
| 42 | `badge` | Badge | Yes | 🟡 | all builds; variants/large text/high contrast | — |
| 43 | `chip` | Chip, ChipGroup | No | ⬜ | selected/removable/group semantics | — |
| 44 | `collapsible` | Collapsible family | No | ⬜ | controlled state/focus/reduced motion | — |
| 45 | `description-list` | DescriptionList, DescriptionItem | No | ⬜ | Web semantics/native grouping | — |
| 46 | `list-group` | ListGroup family | No | ⬜ | grouping/large text | — |
| 47 | `list-item` | ListItem, SettingsItem | No | ⬜ | press semantics/trailing controls | — |
| 48 | `metadata-row` | MetadataRow | No | ⬜ | wrapping/long content/semantics | — |
| 49 | `progress` | Progress | No | ⬜ | value/indeterminate/reduced motion | — |
| 50 | `skeleton` | Skeleton | No | ⬜ | reduced motion/hidden semantics | — |
| 51 | `spinner` | Spinner | No | ⬜ | busy/status/reduced motion | — |
| 52 | `stat` | Stat family | No | ⬜ | numeric typography/long labels | — |
| 53 | `state-message` | EmptyState, ErrorState | No | ⬜ | actions/announcements | — |
| 54 | `table` | Table family | Yes | 🚨 | `TYPE BUILD-WEB SOURCE DOC WEB-RUNTIME`: real table/thead/tbody/column-header semantics pass; accessibility-label bridge still mismatches | [#546](https://github.com/beobungbu/BeeUI/issues/546) |
| 55 | `text` | Text | Yes | 🟡 | all builds; dynamic type/zoom/RTL/long strings | — |
| 56 | `timeline` | Timeline family | No | ⬜ | semantics/wrapping | — |
| 57 | `visually-hidden` | VisuallyHidden | No | ⬜ | browser + VoiceOver/TalkBack | — |

## Date / time — 3

| # | Module | Public family | Used | Status | Evidence / next | Issue |
| ---: | --- | --- | ---: | --- | --- | --- |
| 58 | `calendar` | Calendar | No | ⬜ | Web/native nav/locale/disabled dates | — |
| 59 | `date-picker` | DatePicker | No | ⬜ | iOS/Android system picker runtime + Web non-support truth | — |
| 60 | `date-time-picker` | DateTimePicker | No | ⬜ | iOS/Android runtime + Android chained flow | — |

## Theme / runtime helpers — 2

| # | Module | Public family | Used | Status | Evidence / next | Issue |
| ---: | --- | --- | ---: | --- | --- | --- |
| 61 | `theme-scope` | BeeThemeScope | No | ⬜ | scoped brand/appearance nesting + portals | — |
| 62 | `use-bee-token` | getBeeToken, useBeeToken | No | ⬜ | global/scoped reads + override reactivity | — |

**Inventory invariant: 10 + 7 + 14 + 7 + 19 + 3 + 2 = 62 public modules.**

---

# L2 — Contract-level matrix for surfaces already exercised

## Provider / SafeArea

| Contract | Status | Evidence | To reach full verification | Issue |
| --- | --- | --- | --- | --- |
| Exactly one root BeeUIProvider | 🔧 CONSUMER FIXED | source/docs audit + all builds | Add regression assertion | — |
| Provider encloses all BeeUI consumers | 🔧 CONSUMER FIXED | source audit + all builds + Toast provider `WEB-RUNTIME` | Modal/anchored/native runtime | — |
| Native top inset owner | 🟡 | composition + builds | notched iOS/Android runtime | — |
| Native bottom inset owner | 🟡 | composition + builds | home-indicator/navigation-bar runtime | — |
| Web root SafeArea policy | 🚨 | current docs contradict | align docs + starter + LLM guidance | [#547](https://github.com/beobungbu/BeeUI/issues/547) |

## Global theme

| Contract | Status | Evidence | To reach full verification | Issue |
| --- | --- | --- | --- | --- |
| Light | ✅ Web | `TYPE`, builds, Playwright/visual | native runtime | [#545](https://github.com/beobungbu/BeeUI/issues/545) |
| Dark | ✅ Web | `TYPE`, builds, Playwright/visual | native runtime | [#545](https://github.com/beobungbu/BeeUI/issues/545) |
| System restore | ✅ Web | browser color-scheme change after restore | native OS toggle runtime | [#545](https://github.com/beobungbu/BeeUI/issues/545) |
| Preference persistence app-owned | ✅ | localStorage / AsyncStorage | keep outside BeeUI state authority | — |
| System + Bee brand | 🟡 | Web runtime + native bundle | native runtime | [#545](https://github.com/beobungbu/BeeUI/issues/545) |
| System + Violet/custom brand | ⬜ | source docs only | define adaptive-brand contract + consumer runtime test | [#545](https://github.com/beobungbu/BeeUI/issues/545) |
| BeeThemeScope | ⬜ | — | scoped-theme fixture | — |
| useBeeToken/getBeeToken | ⬜ | — | scope + runtime-override fixture | — |

## Web package / bundling

| Contract | Status | Evidence | Issue |
| --- | --- | --- | --- |
| npm RC resolves | ✅ runtime / 🚨 guidance | clean consumer install/build | [#543](https://github.com/beobungbu/BeeUI/issues/543) |
| RNW Vite plugin | ✅ | config matches canonical example + Vite 8 build/runtime; `vite-plugin-rnw@0.0.12` emits a Vite-9 future-deprecation warning, so reverify before bumping | — |
| Tailwind Vite plugin | ✅ | build/runtime | — |
| Uniwind Vite plugin | ✅ | build/theme runtime | — |
| theme.css import | ✅ | package CSS consumed | — |
| BeeUI `@source` globs | ✅ | classes emitted/rendered | — |
| BeeECOM shared-UI `@source` | ✅ | app-ui classes emitted | — |
| Web root composition docs | 🚨 | onboarding vs provider guide conflict | [#547](https://github.com/beobungbu/BeeUI/issues/547) |

## Input

| Contract | Status | Evidence | Next |
| --- | --- | --- | --- |
| value/onChangeText | ✅ | `TYPE` + all builds | — |
| accessibilityLabel | 🟡 | Web usage + builds | accessibility-tree + native runtime |
| Field association | ⬜ | docs/source only | real validation form |
| invalid/disabled/focus | ⬜ | — | Web/native interaction + a11y |

## Select

| Contract | Status | Evidence | Next |
| --- | --- | --- | --- |
| controlled value/onValueChange | ✅ | `TYPE` + all builds | — |
| trigger name | ✅ Web | Playwright `getByLabel` resolves the combobox trigger | native runtime |
| open/select/close | ✅ Web | ArrowDown opens, typeahead + Enter selects/closes, Escape closes | native runtime |
| keyboard/typeahead/Escape | ✅ Web | Chromium package-consumer test, PR #30 run #94 | native runtime |
| focus restore after dismiss | ✅ Web | trigger focused again after Escape | native runtime |
| flip/shift/collision | ✅ Web | listbox remains inside 390×300 constrained viewport | native runtime + more placements |
| provider/portal nesting | 🟡 | root provider corrected + ordinary Select portal runtime | nested overlay/modal runtime |

## Table

| Contract | Status | Evidence | Next | Issue |
| --- | --- | --- | --- | --- |
| real Web table semantics | ✅ Web | Chromium asserts table + thead + tbody + five `th[scope=col]` + rows/cells | stacked/sort/selection + native runtime | [#546](https://github.com/beobungbu/BeeUI/issues/546) |
| RN accessibilityLabel → Web aria-label | 🚨 | source shows plain HTML path without bridge | upstream fix + consumer regression | [#546](https://github.com/beobungbu/BeeUI/issues/546) |
| scroll layout | 🟡 | realistic Admin inventory + Web semantic runtime | responsive overflow assertion | — |
| stacked layout | ⬜ | — | compact-width fixture | — |
| sort contract | ⬜ | — | caller state + aria-sort/native semantics | — |
| selection contract | ⬜ | — | caller state + a11y | — |

## Toast

| Contract | Status | Evidence | Next |
| --- | --- | --- | --- |
| provider-scoped `useToast()` runtime | ✅ Web | real Admin mutation invokes Toast under the single root provider | native runtime |
| success Toast content | ✅ Web | title + mutation description rendered in Toast live region | variant/state expansion |
| live announcement surface | ✅ Web | Chromium asserts visible `[aria-live]` containing the Toast title/description | native announcement evidence |
| destructive/error Toast | 🟡 | app path wired and type/build verified | trigger a deterministic failing mutation and assert runtime semantics |
| FIFO / max-visible queue | ⬜ | — | burst multiple toasts and assert documented queue/order |
| persistent + action | ⬜ | — | real retry/undo action flow |
| safe-area placement | ⬜ | — | native notched-device/emulator runtime |

---

# L3 — BeeUI issue index from BeeECOM evidence

| Issue | Classification | Matrix areas |
| --- | --- | --- |
| [#543](https://github.com/beobungbu/BeeUI/issues/543) | npm publication truth drift across cookbook/LLM/generated docs | P01 P20 P21 |
| [#544](https://github.com/beobungbu/BeeUI/issues/544) | Expo package-consumer compatibility pin drift | P03 |
| [#545](https://github.com/beobungbu/BeeUI/issues/545) | System-theme human/LLM guidance gap | P07 + Theme L2 |
| [#546](https://github.com/beobungbu/BeeUI/issues/546) | Table Web accessibility API/runtime divergence | P11 P15 + Table L2 |
| [#547](https://github.com/beobungbu/BeeUI/issues/547) | Web SafeArea onboarding contradiction | P06 P20 + Provider/Web L2 |
| [#473](https://github.com/beobungbu/BeeUI/issues/473) | umbrella public-surface documentation ownership | P22 |

---

# Update rules

1. Build/typecheck alone never makes a cross-platform row VERIFIED.
2. Web, iOS and Android evidence are separate; native bundle evidence is not native runtime evidence.
3. Human `DOC` and machine/agent `LLM` guidance are separate evidence classes.
4. If BeeECOM is wrong and BeeUI docs/source agree, fix BeeECOM and use `🔧 CONSUMER FIXED`; do not file upstream noise.
5. If docs/LLM/type/runtime disagree, create or reuse a concrete BeeUI issue and use `🚨 MISMATCH`.
6. Reuse the same BeeUI issue for the same root cause; append evidence rather than create duplicates.
7. Every BeeECOM PR that newly exercises a BeeUI family must update this matrix.
8. Evidence should point to an exact PR/head/run when available; an older green SHA never certifies a newer head.
9. Out-of-scope requires an explicit rationale; otherwise the row remains `⬜ NOT CHECKED`.
10. Release readiness must report both **surface coverage** and **evidence depth**.