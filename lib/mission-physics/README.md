# LUNA payload capacity

## Default game reference

The game uses `assessGameplayPayload`, as requested by the user: Quality supplies
balanced thrust and effective engine efficiency, stage architecture improves the
transfer estimate, known masses are retained and unspecified masses receive game
estimates. Separate launch, lunar and return masses are used with one finite fuel
reserve. The numerical payload allowance changes with the selected parts.

Before fueling, the reference assumes a planned full 30,000 kg load, labelled
“Planned fuel”. After fueling opens it uses the actual load, including zero.
These Quality estimates are advisory and do not add purchase/launch gates.
Catalog specifications, receipts and the existing flight engine are not rewritten.

## Strict alternative

Pure TypeScript calculation shared by the game client and API. There is no
fixed payload ceiling and no quality-to-thrust, quality-to-Isp or missing-mass
fallback. Tests use synthetic fixtures; those numbers are not game catalog data.

## Inputs

- One selected component per builder category, including the hull. Mass is dry
  mass. Engine thrust is in newtons and **effective** Isp in seconds. For several
  engines firing together, exhaust velocity is total thrust divided by total
  propellant mass flow, not an average Isp. Dormant upper/lunar engines do not
  contribute to launch TWR.
- Selected scientific instruments and credited sampler/container hardware.
  Credited hardware is moved into payload accounting, not counted twice.
- Actual paid fuel loaded by the player, not tank capacity or a guessed fill.
- A cited profile for the selected stage architecture: complete component and
  ignition assignments, propellant fractions summing to one, burn delta-V
  requirements and explicit stage separation events.

All selected hardware stays attached until a documented separation event.
Payload stays aboard throughout the specified trajectory. A discarded stage
takes both its dry mass and its unspent propellant with it. Later-stage
propellant is inaccessible to earlier-stage engines; repeat burns on a retained
stage draw from the same remaining supply. Landing and return burns participate
in every capacity probe.

## Output and numerical method

Maximum capacity is **total allowable payload**. Remaining capacity is maximum
minus current payload (the additional cargo allowance; negative if overweight).
The solver evaluates every required burn with the rocket equation, tracking mass,
fuel and separation. It bisects feasible payload under the analytical launch-TWR
mass bound, requiring TWR strictly greater than one and enough delta-V for every
maneuver. TWR below 1.2 receives an advisory, not an invented performance boost.
Available mission delta-V includes achieved maneuvers plus the residual attached
final-stage margin, never discarded propellant.

Missing, non-finite or invalid specifications produce `INCOMPLETE`, named missing
fields and null capacity. Known zero fuel is not missing data: it produces an
infeasible calculation. Neither the old cinematic flight model nor its assumed
mass or performance parameters are used.

## Catalog completion for the strict alternative

Actual engine values are read only from explicitly labelled unit-bearing catalog
parameters. Hull mass remains null until a source supplies it.
`luna-payload-profiles.ts` is intentionally empty until documented stage
assignments, fuel allocation and LUNA burn requirements are available. Profiles
are keyed by the selected `rocket-stages` option ID and exposed through the typed
catalog API. Do not fill this registry with test figures.

Those incomplete-data rules apply to `assessPayload`, the retained strict utility.
The game client and server now use the user-approved Quality reference instead,
so absent catalog specifications do not leave the live payload panel blank.
