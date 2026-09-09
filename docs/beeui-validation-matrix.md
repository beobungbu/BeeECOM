# BeeUI external-consumer validation matrix

> Canonical BeeECOM tracker for validating BeeUI from an external application.
>
> BeeUI source authority: `development` branch, public surface derived from `registry/registry.json`, `packages/ui/src/index.ts`, package manifests and generated `llms-components.txt`.
> BeeECOM package baseline: `@beemvp/beeui-* 0.86.2-rc.1` unless a row says otherwise.
>
> This matrix is intentionally stricter than “build passed”. A surface is **VERIFIED** only for the evidence classes explicitly recorded in that row.

## Status legend

| Status | Meaning |
| --- | --- |
| ✅ VERIFIED | The stated contract has direct evidence for every evidence class required by that row. |
| 🟡 PARTIAL | Some evidence exists, but one or more required platform/runtime/a11y/docs dimensions remain unproved. |
| 🧪 IN PROGRESS | Active validation is underway on the current BeeECOM branch/PR. |
| 🚨 MISMATCH | BeeUI human docs, LLM guidance, package/type surface or runtime behavior disagree. An upstream issue should exist. |
| 🔧 CONSUMER FIXED | BeeECOM was using BeeUI incorrectly; BeeUI contract was coherent and BeeECOM was corrected. |
| ⬜ NOT CHECKED | No BeeECOM-specific validation has been completed yet. |
| ⛔ BLOCKED | Validation cannot honestly complete until a dependency/upstream problem is resolved. |

## Evidence classes

| Code | Evidence |
| --- | --- |
| `PKG` | Clean/external package resolution or install at the public package boundary. |
| `TYPE` | Strict TypeScript/public API acceptance. |
| `BUILD-WEB` | Production Web build/export. |
| `BUILD-IOS` | iOS bundle/export/compile evidence. |
| `BUILD-ANDROID` | Android bundle/export/compile evidence. |
| `WEB-RUNTIME` | Real browser interaction/behavior evidence. |
| `IOS-RUNTIME` | iOS simulator/device runtime evidence. |
| `ANDROID-RUNTIME` | Android emulator/device runtime evidence. |
| `A11Y` | Accessibility-tree/axe/keyboard/screen-reader evidence appropriate to the claim. |
| `RESP` | Explicit responsive/reflow/viewport evidence. |
| `VISUAL` | Screenshot/visual-regression evidence. |
| `DOC` | Current human-facing BeeUI docs reviewed against source/runtime. |
| `LLM` | Current `llms*.txt` / AI-agent guidance reviewed against source/runtime. |
| `SOURCE` | BeeUI implementation/public source contract directly reviewed. |

---

# L0 — BeeUI product-capability matrix

| ID | Capability | BeeECOM coverage | Status | Evidence obtained | Missing evidence / next check | BeeUI issue ref |
| --- | --- | --- | --- | --- | --- | --- |
| P01 | Distribution / npm RC consumption | BeeECOM installs and builds against `0.86.2-rc.1` public package boundary | 🚨 MISMATCH | `PKG`, `TYPE`, `BUILD-WEB`, `BUILD-IOS`, `BUILD-ANDROID`, `DOC`, `LLM` | Publication-state authority must agree across README, generated docs and LLM files | [BeeUI #543](https://github.com/beobungbu/BeeUI/issues/543) |
| P02 | React / React Native / RN Web compatibility | React 19.2.3, RN 0.86.2, RN Web 0.21.0 consumer path exercised | 🟡 PARTIAL | `TYPE`, `BUILD-WEB`, `BUILD-IOS`, `BUILD-ANDROID` | Dedicated runtime parity and dependency-drift checks | — |
| P03 | Expo SDK 57 package-consumer compatibility | Expo consumer bundles successfully but clean install exposes metro-runtime peer drift | 🚨 MISMATCH | `PKG`, `BUILD-WEB`, `BUILD-IOS`, `BUILD-ANDROID` | Resolve Expo / `@expo/metro-runtime` canonical pin; native runtime remains separate | [BeeUI #544](https://github.com/beobungbu/BeeUI/issues/544) |
| P04 | Vite + React Native Web integration | BeeECOM uses RNW → Tailwind → Uniwind plugin ordering and canonical CSS source globs | ✅ VERIFIED | `SOURCE`, `DOC`, `TYPE`, `BUILD-WEB`, `WEB-RUNTIME` | Re-check on BeeUI/toolchain version bump | — |
| P05 | Provider/runtime root | One application-root `BeeUIProvider` per Storefront, Admin and Mobile | 🔧 CONSUMER FIXED | `SOURCE`, `DOC`, `TYPE`, `BUILD-WEB`, `BUILD-IOS`, `BUILD-ANDROID` | Native overlay/toast runtime coverage still belongs to their component rows | — |
| P06 | Safe-area ownership | Mobile explicitly owns top/bottom/left/right in current shell; Web does not rely on native inset behavior | 🚨 MISMATCH | `SOURCE`, `DOC`, `TYPE`, `BUILD-IOS`, `BUILD-ANDROID` | Real notched-device/simulator evidence; resolve contradictory Web docs | [BeeUI #547](https://github.com/beobungbu/BeeUI/issues/547) |
| P07 | Global theme preference | `system | light | dark`, app-owned persistence, direct Uniwind authority | 🚨 MISMATCH | `TYPE`, `BUILD-WEB`, `BUILD-IOS`, `BUILD-ANDROID`, `WEB-RUNTIME`, `VISUAL`, `SOURCE`, `DOC`, `LLM` | Native OS-change runtime proof; clarify branded System semantics | [BeeUI #545](https://github.com/beobungbu/BeeUI/issues/545) |
| P08 | Scoped themes / `BeeThemeScope` | Not yet consumed by BeeECOM | ⬜ NOT CHECKED | — | Add branded/scoped merchandising/admin surface and verify nesting + token reads | — |
| P09 | Semantic tokens / theme CSS | BeeECOM uses `@beemvp/beeui-tokens/theme.css` and semantic utility names | 🟡 PARTIAL | `PKG`, `TYPE`, `BUILD-WEB`, `BUILD-IOS`, `BUILD-ANDROID`, `SOURCE` | Systematic color/spacing/type/motion token coverage and runtime overrides | — |
| P10 | Responsive layout / breakpoints | Storefront/Admin exercise mobile-first Web breakpoints; Mobile uses measured width for phone/tablet | 🟡 PARTIAL | `BUILD-WEB`, `BUILD-IOS`, `BUILD-ANDROID`, partial `RESP` | Formal viewport matrix, zoom/reflow, landscape, tablet and large-text evidence | — |
| P11 | Accessibility baseline | Accessible labels are used on active controls; automated app-level checks exist | 🟡 PARTIAL | partial `A11Y`, `WEB-RUNTIME`, `TYPE` | Per-component keyboard/focus/name/state + native assistive-tech evidence | [BeeUI #546](https://github.com/beobungbu/BeeUI/issues/546) |
| P12 | Forms and selection | Input + Select are used in storefront/admin/mobile flows | 🟡 PARTIAL | `TYPE`, `BUILD-WEB`, `BUILD-IOS`, `BUILD-ANDROID`, `DOC`, `SOURCE` | Explicit keyboard/typeahead/focus/native runtime and validation compositions | — |
| P13 | Anchored overlays | Select exercises BeeUI anchored-overlay runtime | 🟡 PARTIAL | `TYPE`, `BUILD-WEB`, `BUILD-IOS`, `BUILD-ANDROID`, `DOC`, `SOURCE` | Browser geometry/flip/shift/dismiss + native runtime evidence; Popover/Menu/Tooltip unused | — |
| P14 | Modal overlays / Sheet | Not yet used by BeeECOM | ⬜ NOT CHECKED | — | Add Dialog/AlertDialog/Sheet flows with provider, focus and gesture evidence | — |
| P15 | Data display / Table | Admin uses Table against realistic inventory data | 🚨 MISMATCH | `TYPE`, `BUILD-WEB`, `SOURCE`, `DOC` | Web accessibility prop bridge and explicit table a11y/runtime tests | [BeeUI #546](https://github.com/beobungbu/BeeUI/issues/546) |
| P16 | Feedback / status / loading | Badge/Card/Text + app-owned status messages in use; Toast not yet consumed | 🟡 PARTIAL | `TYPE`, `BUILD-WEB`, `BUILD-IOS`, `BUILD-ANDROID` | Toast queue/scope/a11y; Spinner/Skeleton/StateMessage families | — |
| P17 | Date/time controls | No BeeECOM date picker/calendar workflow yet | ⬜ NOT CHECKED | — | Calendar Web/native + native DatePicker/DateTimePicker contracts | — |
| P18 | Navigation/content primitives | Current app uses buttons/sections composed locally, not BeeUI Tabs/Breadcrumb/etc. | ⬜ NOT CHECKED | — | Tabs, Breadcrumb, Pagination, ListItem, Stepper, Timeline, Link | — |
| P19 | Source-ownership CLI / Registry | BeeECOM intentionally validates package model first | ⬜ NOT CHECKED | — | Independent `beeui add` consumer path, registry closure, update/diff/doctor | — |
| P20 | Human documentation truth | Install, provider, safe-area, theming, Input/Select/Table docs compared against consumer usage | 🚨 MISMATCH | `DOC`, `SOURCE`, consumer evidence | Continue every component row; remove generated stale publication banners and safe-area conflict | [#543](https://github.com/beobungbu/BeeUI/issues/543), [#547](https://github.com/beobungbu/BeeUI/issues/547) |
| P21 | LLM / agent guidance truth | `llms-components`, `llms-full`, AI cookbook compared to package/runtime behavior | 🚨 MISMATCH | `LLM`, `SOURCE`, consumer evidence | Publication truth + System theme guidance + per-component recommendation parity | [#543](https://github.com/beobungbu/BeeUI/issues/543), [#545](https://github.com/beobungbu/BeeUI/issues/545) |
| P22 | Full public component-surface coverage | 62 public component modules inventoried below | 🧪 IN PROGRESS | inventory derived from BeeUI public/generated authority | Exercise every relevant family or explicitly mark out-of-scope with rationale | [BeeUI #473](https://github.com/beobungbu/BeeUI/issues/473) |

---

# L1 — Public component-family coverage

The 62 rows below are the complete public component-module inventory currently exposed by BeeUI `development`. “Used” means BeeECOM currently imports or exercises that family; it does **not** imply full verification.

## Layout, shell and structure

| Component module | Public family | Used in BeeECOM | Status | Evidence | Main remaining checks | BeeUI issue |
| --- | --- | ---: | --- | --- | --- | --- |
| `app-header` | AppHeader | No | ⬜ NOT CHECKED | — | Web/native layout, large text, safe-area composition | — |
| `bottom-action-bar` | BottomActionBar | No | ⬜ NOT CHECKED | — | Bottom inset ownership, large text, keyboard | — |
| `box` | Box | Yes | 🟡 PARTIAL | `TYPE`, all builds, `SOURCE` | Explicit RN/Web prop parity, responsive/large-text stress | — |
| `card` | Card | Yes | 🟡 PARTIAL | `TYPE`, all builds | Variants, pressability if applicable, high-contrast/large text | — |
| `keyboard-aware-screen` | KeyboardAwareScreen | No | ⬜ NOT CHECKED | — | iOS/Android keyboard avoidance runtime | — |
| `safe-area` | BeeUIProvider, SafeArea | Yes | 🚨 MISMATCH | `SOURCE`, `DOC`, all builds | Native runtime insets; Web-doc contradiction | [#547](https://github.com/beobungbu/BeeUI/issues/547) |
| `screen` | Screen | Yes | 🟡 PARTIAL | `TYPE`, all builds, `DOC`, `SOURCE` | Layout/large-text/runtime stress | — |
| `section` | Section | No | ⬜ NOT CHECKED | — | Responsive/content semantics | — |
| `separator` | Separator | No | ⬜ NOT CHECKED | — | Semantics, orientation, high contrast | — |
| `stack` | Stack, HStack, VStack | No | ⬜ NOT CHECKED | — | Responsive wrapping and spacing contracts | — |

## Actions and navigation

| Component module | Public family | Used | Status | Evidence | Main remaining checks | BeeUI issue |
| --- | --- | ---: | --- | --- | --- | --- |
| `button` | Button, ButtonLabel | Yes | 🟡 PARTIAL | `TYPE`, all builds, browser interaction | loading/disabled semantics, keyboard, native press/runtime, large text | — |
| `icon-button` | IconButton | No | ⬜ NOT CHECKED | — | accessible-name requirement, touch target | — |
| `link` | Link | No | ⬜ NOT CHECKED | — | navigation semantics and external/internal behavior | — |
| `breadcrumb` | Breadcrumb, BreadcrumbItem | No | ⬜ NOT CHECKED | — | Web semantics, overflow, RTL | — |
| `pagination` | Pagination, PaginationItem | No | ⬜ NOT CHECKED | — | keyboard, dynamic type, compact viewport | — |
| `tabs` | Tabs, TabsContent, TabsList, TabsTrigger | No | ⬜ NOT CHECKED | — | controlled state, keyboard, focus, native semantics | — |
| `stepper` | Stepper, StepperItem | No | ⬜ NOT CHECKED | — | state ownership, accessibility, overflow | — |

## Forms and selection

| Component module | Public family | Used | Status | Evidence | Main remaining checks | BeeUI issue |
| --- | --- | ---: | --- | --- | --- | --- |
| `field` | Field | No | ⬜ NOT CHECKED | — | label/description/error association | — |
| `form-group` | FormGroup | No | ⬜ NOT CHECKED | — | grouped semantics, spacing, large text | — |
| `form-message` | FormMessage, HelperText | No | ⬜ NOT CHECKED | — | error/status announcements | — |
| `input` | Input | Yes | 🟡 PARTIAL | `TYPE`, all builds, `DOC`, `SOURCE` | Field composition, invalid/disabled, keyboard, native runtime | — |
| `textarea` | Textarea | No | ⬜ NOT CHECKED | — | multiline, resize/native keyboard, large text | — |
| `search-input` | SearchInput | No | ⬜ NOT CHECKED | — | clear/search semantics, keyboard | — |
| `password-input` | PasswordInput | No | ⬜ NOT CHECKED | — | reveal state, secure entry, accessibility | — |
| `otp-input` | OTPInput | No | ⬜ NOT CHECKED | — | autofill, paste, focus, screen reader | — |
| `checkbox` | Checkbox | No | ⬜ NOT CHECKED | — | controlled/uncontrolled, mixed state, native/web a11y | — |
| `radio` | Radio, RadioGroup | No | ⬜ NOT CHECKED | — | arrow keys, group semantics, native parity | — |
| `switch` | Switch | No | ⬜ NOT CHECKED | — | controlled state, native semantics, disabled | — |
| `segmented-control` | SegmentedControl, SegmentedControlItem | No | ⬜ NOT CHECKED | — | keyboard/native semantics, overflow | — |
| `select` | Select family | Yes | 🟡 PARTIAL | `TYPE`, all builds, `DOC`, `SOURCE` | Web keyboard/typeahead/focus/geometry; iOS/Android runtime | — |

## Overlay, modal and transient UI

| Component module | Public family | Used | Status | Evidence | Main remaining checks | BeeUI issue |
| --- | --- | ---: | --- | --- | --- | --- |
| `dialog` | Dialog family | No | ⬜ NOT CHECKED | — | focus trap/restore, Escape/back, native modal semantics | — |
| `alert-dialog` | AlertDialog family | No | ⬜ NOT CHECKED | — | destructive confirmation semantics/focus | — |
| `popover` | Popover family | No | ⬜ NOT CHECKED | — | anchored geometry, collision, dismissal | — |
| `dropdown-menu` | DropdownMenu family | No | ⬜ NOT CHECKED | — | keyboard/typeahead/radio/checkbox menu semantics | — |
| `sheet` | Sheet family | No | ⬜ NOT CHECKED | — | native gesture providers, snap/dismiss, keyboard/a11y | — |
| `tooltip` | Tooltip family | No | ⬜ NOT CHECKED | — | hover/focus/long-press, timing, a11y | — |
| `toast` | useToast | No | ⬜ NOT CHECKED | — | provider scope, queue, action, live announcement, safe area | — |

## Data display, status and content

| Component module | Public family | Used | Status | Evidence | Main remaining checks | BeeUI issue |
| --- | --- | ---: | --- | --- | --- | --- |
| `accordion` | Accordion family | No | ⬜ NOT CHECKED | — | keyboard, expanded state, large text | — |
| `alert-banner` | AlertBanner | No | ⬜ NOT CHECKED | — | status semantics, actions, wrapping | — |
| `avatar` | Avatar | No | ⬜ NOT CHECKED | — | fallback/image semantics, sizes | — |
| `badge` | Badge | Yes | 🟡 PARTIAL | `TYPE`, all builds | variants, large text/high contrast | — |
| `chip` | Chip, ChipGroup | No | ⬜ NOT CHECKED | — | selected/removable/group semantics | — |
| `collapsible` | Collapsible family | No | ⬜ NOT CHECKED | — | controlled state, focus, animation/reduced motion | — |
| `description-list` | DescriptionList, DescriptionItem | No | ⬜ NOT CHECKED | — | Web semantics/native accessible grouping | — |
| `list-group` | ListGroup, ListGroupHeader | No | ⬜ NOT CHECKED | — | grouping, large text | — |
| `list-item` | ListItem, SettingsItem | No | ⬜ NOT CHECKED | — | press/action semantics, trailing controls | — |
| `metadata-row` | MetadataRow | No | ⬜ NOT CHECKED | — | wrapping, long content, semantics | — |
| `progress` | Progress | No | ⬜ NOT CHECKED | — | value semantics, indeterminate, reduced motion | — |
| `skeleton` | Skeleton | No | ⬜ NOT CHECKED | — | reduced motion, hidden semantics | — |
| `spinner` | Spinner | No | ⬜ NOT CHECKED | — | busy/status semantics, reduced motion | — |
| `stat` | Stat family | No | ⬜ NOT CHECKED | — | numeric typography, long labels | — |
| `state-message` | EmptyState, ErrorState | No | ⬜ NOT CHECKED | — | action semantics, announcements | — |
| `table` | Table family | Yes | 🚨 MISMATCH | `TYPE`, `BUILD-WEB`, `SOURCE`, `DOC` | `accessibilityLabel → aria-label` Web bridge; stacked/scroll a11y/runtime | [#546](https://github.com/beobungbu/BeeUI/issues/546) |
| `text` | Text | Yes | 🟡 PARTIAL | `TYPE`, all builds | every variant/tone, dynamic type/zoom, RTL/long strings | — |
| `timeline` | Timeline family | No | ⬜ NOT CHECKED | — | semantics, wrapping/long content | — |
| `visually-hidden` | VisuallyHidden | No | ⬜ NOT CHECKED | — | browser + VoiceOver/TalkBack behavior | — |

## Date and time

| Component module | Public family | Used | Status | Evidence | Main remaining checks | BeeUI issue |
| --- | --- | ---: | --- | --- | --- | --- |
| `calendar` | Calendar | No | ⬜ NOT CHECKED | — | Web/native navigation, locale, disabled/range constraints | — |
| `date-picker` | DatePicker | No | ⬜ NOT CHECKED | — | iOS/Android system picker runtime; Web non-support truth | — |
| `date-time-picker` | DateTimePicker | No | ⬜ NOT CHECKED | — | iOS/Android runtime, Android chained flow | — |

## Theme/runtime helpers

| Component module | Public family | Used | Status | Evidence | Main remaining checks | BeeUI issue |
| --- | --- | ---: | --- | --- | --- | --- |
| `theme-scope` | BeeThemeScope | No | ⬜ NOT CHECKED | — | scoped brand/appearance nesting + portal behavior | — |
| `use-bee-token` | getBeeToken, useBeeToken | No | ⬜ NOT CHECKED | — | global vs scoped reads, runtime override reactivity | — |

---

# L2 — Contract-level checks for currently exercised surfaces

This is the “smallest” level: one public family is split into the individual behavior claims BeeECOM must prove.

## Provider / SafeArea

| Contract | Status | Evidence now | Required to reach VERIFIED | Issue |
| --- | --- | --- | --- | --- |
| Exactly one application-root `BeeUIProvider` | 🔧 CONSUMER FIXED | Source/docs audit + all platform builds | Keep regression assertion in app shell | — |
| Provider encloses overlay/theme-control consumers | 🔧 CONSUMER FIXED | Source audit + build | Add runtime overlay/Toast use | — |
| Native top inset has one owner | 🟡 PARTIAL | App composition + build | Notched iOS/Android runtime | — |
| Native bottom inset has one owner | 🟡 PARTIAL | App composition + build | Home-indicator/navigation-bar runtime | — |
| Web root SafeArea policy is unambiguous | 🚨 MISMATCH | Two current BeeUI docs contradict | Align docs + executable starter + LLM guidance | [#547](https://github.com/beobungbu/BeeUI/issues/547) |

## Global theming

| Contract | Status | Evidence now | Required to reach VERIFIED | Issue |
| --- | --- | --- | --- | --- |
| Explicit Light | ✅ VERIFIED for Web | `TYPE`, builds, Playwright/visual | Native runtime visual evidence | [#545](https://github.com/beobungbu/BeeUI/issues/545) |
| Explicit Dark | ✅ VERIFIED for Web | `TYPE`, builds, Playwright/visual | Native runtime visual evidence | [#545](https://github.com/beobungbu/BeeUI/issues/545) |
| Restore to System | ✅ VERIFIED for Web | Browser color-scheme switch after restore | iOS/Android OS-theme toggle runtime | [#545](https://github.com/beobungbu/BeeUI/issues/545) |
| Preference persistence belongs to app | ✅ VERIFIED | localStorage / AsyncStorage consumer implementation | Keep app-owned; no BeeUI store | — |
| System + Bee brand | 🟡 PARTIAL | Web runtime, native bundle | Native runtime | [#545](https://github.com/beobungbu/BeeUI/issues/545) |
| System + Violet/custom brand | ⬜ NOT CHECKED | Source docs show explicit `brand × appearance` registry | Define/document adaptive-brand System contract, then test | [#545](https://github.com/beobungbu/BeeUI/issues/545) |
| Scoped theme (`BeeThemeScope`) | ⬜ NOT CHECKED | — | Add consumer fixture | — |
| `useBeeToken` scope reactivity | ⬜ NOT CHECKED | — | Add consumer fixture | — |

## Web package/bundling

| Contract | Status | Evidence now | Required to reach VERIFIED | Issue |
| --- | --- | --- | --- | --- |
| Public npm RC resolves | ✅ VERIFIED | BeeECOM package install/build | Publication docs must stop saying unpublished | [#543](https://github.com/beobungbu/BeeUI/issues/543) |
| RNW plugin configured | ✅ VERIFIED | BeeECOM Vite config matches canonical example | Version bump revalidation only | — |
| Tailwind plugin configured | ✅ VERIFIED | build + emitted UI styling | Version bump revalidation only | — |
| Uniwind plugin configured | ✅ VERIFIED | build + runtime theme tests | Version bump revalidation only | — |
| `theme.css` imported | ✅ VERIFIED | package CSS consumed in Web | — | — |
| BeeUI `@source` globs present | ✅ VERIFIED | generated utility classes render | — | — |
| App-local shared UI `@source` glob present | ✅ VERIFIED | `@beeecom/app-ui/src` scanned | — | — |
| Web onboarding root composition matches runtime starter | 🚨 MISMATCH | current docs disagree on SafeArea | Fix docs authority | [#547](https://github.com/beobungbu/BeeUI/issues/547) |

## Input

| Contract | Status | Evidence now | Required to reach VERIFIED | Issue |
| --- | --- | --- | --- | --- |
| `value/onChangeText` public API | ✅ VERIFIED | Type/build across targets | — | — |
| `accessibilityLabel` on RNW/native path | 🟡 PARTIAL | build + Web app usage | Accessibility-tree assertion + native runtime | — |
| `Field` label/description/error integration | ⬜ NOT CHECKED | Docs/source reviewed only | Add real form validation fixture | — |
| disabled/invalid/focus semantic styling | ⬜ NOT CHECKED | — | Web/native interaction + a11y | — |

## Select / anchored overlay

| Contract | Status | Evidence now | Required to reach VERIFIED | Issue |
| --- | --- | --- | --- | --- |
| Controlled `value/onValueChange` | ✅ VERIFIED | Type/build on all targets | — | — |
| Trigger accessible name | 🟡 PARTIAL | `accessibilityLabel` used | browser accessibility-tree + native runtime | — |
| Listbox open/select/close | 🟡 PARTIAL | package builds and app composition | explicit browser interaction + iOS/Android runtime | — |
| Keyboard arrows/typeahead/Escape | ⬜ NOT CHECKED | — | Playwright keyboard suite | — |
| flip/shift/collision geometry | ⬜ NOT CHECKED | — | constrained viewport tests | — |
| provider/portal nesting | 🟡 PARTIAL | correct root provider verified | nested modal/overlay runtime | — |

## Table

| Contract | Status | Evidence now | Required to reach VERIFIED | Issue |
| --- | --- | --- | --- | --- |
| Real Web table semantics | 🟡 PARTIAL | source review + production build | Browser DOM/accessibility assertions | [#546](https://github.com/beobungbu/BeeUI/issues/546) |
| RN-style `accessibilityLabel` maps correctly on Web | 🚨 MISMATCH | source shows plain HTML spread without explicit bridge | BeeUI fix + package-consumer regression test | [#546](https://github.com/beobungbu/BeeUI/issues/546) |
| Scroll layout | 🟡 PARTIAL | Admin realistic dense inventory | responsive browser test | — |
| Stacked layout | ⬜ NOT CHECKED | — | compact-width fixture + labels | — |
| Sort contract | ⬜ NOT CHECKED | — | caller-owned sort state + `aria-sort`/native semantics | — |
| Selection contract | ⬜ NOT CHECKED | — | caller-owned selected state + a11y | — |

---

# L3 — BeeUI issue index discovered by BeeECOM

| BeeUI issue | Classification | BeeECOM discovery/evidence | Matrix areas |
| --- | --- | --- | --- |
| [#543](https://github.com/beobungbu/BeeUI/issues/543) — AI-agent cookbook contradicts current npm RC publication status | Docs + LLM + generated-doc truth drift | Public RC works in BeeECOM while cookbook, `llms*` and generated component banners say unpublished | P01, P20, P21 |
| [#544](https://github.com/beobungbu/BeeUI/issues/544) — Expo package-consumer starter pins metro-runtime below current Expo 57 peer floor | Compatibility/reference-consumer drift | Clean BeeECOM install exposes unmet peer warning; builds still succeed | P03 |
| [#545](https://github.com/beobungbu/BeeUI/issues/545) — document System theme preference and restore semantics | Docs/LLM gap | BeeECOM proves `system → light/dark → system` on Web and bundles native | P07, theming L2 |
| [#546](https://github.com/beobungbu/BeeUI/issues/546) — Table Web RN accessibilityLabel accepted but not mapped to aria-label | Runtime/platform/API accessibility divergence | BeeECOM Table usage compiles, source audit shows plain-HTML path can silently lose semantic mapping | P11, P15, Table L2 |
| [#547](https://github.com/beobungbu/BeeUI/issues/547) — Web onboarding and provider/safe-area guide contradict root SafeArea policy | Human-doc + agent-guidance contradiction | Two current canonical-looking docs prescribe incompatible Web roots | P06, P20, Web L2 |
| [#473](https://github.com/beobungbu/BeeUI/issues/473) — full BeeUI public-surface documentation contract | Parent/system coverage | BeeECOM uses this as the upstream umbrella for complete public-surface ownership, not as a substitute for concrete consumer bugs | P22 |

---

# Update rules

1. **Never mark a family VERIFIED from build/typecheck alone.** Record the evidence class actually obtained.
2. A cross-platform claim requires separate Web, iOS and Android evidence. Native bundle evidence is not native runtime evidence.
3. A documentation claim is checked twice: human docs (`DOC`) and machine/agent guidance (`LLM`).
4. When BeeECOM is wrong and BeeUI docs/source agree, fix BeeECOM and mark `🔧 CONSUMER FIXED`; do not create an upstream issue.
5. When docs/LLM/type/runtime disagree, create or link a concrete BeeUI issue and mark `🚨 MISMATCH`.
6. Reuse an existing BeeUI issue when the new evidence has the same root cause; add evidence instead of creating duplicates.
7. Every BeeECOM PR that newly exercises a BeeUI public family should update this matrix in the same change.
8. Evidence should point to an exact BeeECOM PR/head/run when available; never use an obsolete green SHA to certify a newer head.
9. “Out of scope” is allowed only with an explicit rationale; otherwise untested public families stay `⬜ NOT CHECKED`.
10. A BeeUI release-readiness claim should report both **surface coverage** and **evidence depth**, not only percentage of rows touched.
