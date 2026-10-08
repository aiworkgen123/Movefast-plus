/**
 * WHICH PICTURE EACH SHOT DRAWS, DECIDED FOR THE WHOLE FILM AT ONCE.
 *
 * ##########################################################################
 * # THIS REPLACES A GREEDY PER-SCENE PICK, AND THE GREEDY PICK WAS THE      #
 * # DEFECT BEHIND THREE DAYS OF THE CLIENT SENDING BACK THE SAME FRAME.     #
 * #                                                                        #
 * # `source.ts` loops scenes and each one takes `ranked[0]` from a pool     #
 * # ranked against that scene alone. The only cross-scene memory is three   #
 * # backward-looking maps, so shot 9 cannot know shot 21 needs the same     #
 * # papyrus more. Five separate repeat penalties were shipped on top of     #
 * # that loop between 2026-09-04 and 2026-09-07 and each one moved between  #
 * # one and five frames of a 58-shot film.                                  #
 * #                                                                        #
 * # MEASURED ON THE DELIVERED CUT, job 0d4dec42. 275 distinct pictures were #
 * # fetched and judged, 134 of them scored at or above the accept gate of   #
 * # 4, and the film drew 45 distinct pictures over 51 shots with 4 of them  #
 * # repeated. 87 usable pictures were never used at all. THE SUPPLY WAS     #
 * # NEVER THE PROBLEM. The allocation was.                                  #
 * #                                                                        #
 * # REPLAYED OVER EVERY PLAN STILL ON THE BOX, seven films, 549 scenes:     #
 * #                                                                        #
 * #   job        shots   greedy pics/distinct/repeats   this pics/dist/rep  #
 * #   14836023      39        36 / 34 / 2                  39 / 39 / 0      #
 * #   2629eec5      58        54 / 52 / 2                  55 / 55 / 0      #
 * #   3ea6388b     112       102 / 93 / 8                 102 /102 / 0      #
 * #   99414763     166       135 /126 / 8                 146 /146 / 0      #
 * #   d421138e      58        50 / 49 / 1                  54 / 54 / 0      #
 * #   f17489be      58        54 / 53 / 1                  55 / 55 / 0      #
 * #   0d4dec42      58        51 / 45 / 4                  58 / 58 / 0      #
 * #                                                                        #
 * # ZERO REPEATS ON ALL SEVEN, more shots carry a picture on six of seven,  #
 * # and the TOTAL judged score rises on all seven. The price is that a      #
 * # handful of shots per film take a weaker picture so a different shot can #
 * # have one at all. A version that capped how far any one shot may fall    #
 * # was measured too, and it was worse on every film, so there is no cap.   #
 * ##########################################################################
 *
 * ##########################################################################
 * # BARREL ONLY, NEVER A SUBPATH. Trap SS, exactly as `sections.ts` and     #
 * # `visualPlan.ts` above it. The compositor imports four subpaths of this  #
 * # package and nothing else, so a barrel export cannot reach `bundleHash`. #
 * # Adding `./assignment` to package.json's exports map would, and every    #
 * # future edit here would then re-render the client's whole film.          #
 * ##########################################################################
 */

/** One picture a scene could draw, and what the judge thought of it THERE. */
export type AssignmentCandidate = {
  /** The scene this score belongs to. The same picture scores differently elsewhere. */
  readonly sceneIndex: number
  /**
   * WHAT MAY ONLY BE SPENT ONCE. A `contentHash` in production rather than an
   * asset id, because the same bytes can be stored under two rows and drawing
   * them twice is the repeat the client sees.
   */
  readonly key: string
  /** The judged fit, on whatever band was in force. Higher is better. */
  readonly score: number
}

export type AssignmentOptions = {
  /**
   * The lowest score that may reach the screen. Below it there is NO EDGE at
   * all rather than a penalty, so a shot goes empty instead of drawing
   * something untrue. `TEXT_CARD_BELOW_SCORE` is 4 and the client's rule 6 is
   * "always when using an Image make sure it's 100% related on the script".
   */
  readonly gate: number
  /**
   * Pictures already spent elsewhere in the film and therefore unavailable.
   *
   * ######################################################################
   * # DEVICE PANELS DRAW PICTURES AND NOTHING USED TO COUNT THEM.        #
   * #                                                                    #
   * # `source.ts` hands three runner-up pictures to each scene and the   #
   * # planner draws them inside the frame. MEASURED on job 0d4dec42, 22  #
   * # pictures reach the screen that way, and the black-and-white        #
   * # painting of Jesus is on screen THREE times: inside the strip at    #
   * # shot 10 and full-frame at shots 21 and 56. Every repeat rule in    #
   * # the pipeline could see only two of the three.                      #
   * #                                                                    #
   * # Without this set the solver would report zero repeats while        #
   * # inventing new ones, which is worse than the rule it replaces.      #
   * ######################################################################
   */
  readonly reserved?: ReadonlySet<string>
}

/*
 * COSTS ARE INTEGERS, AND THAT IS LOAD-BEARING RATHER THAN TIDY.
 *
 * Bellman-Ford compares path costs, and a float comparison needs an epsilon
 * that is itself a tuning knob nobody would ever revisit. Scores arrive from
 * the database as `real` and are almost always whole numbers, but `finalScore`
 * carries fractions once the depiction and tradition charges have been taken.
 * Scaling by 1000 and rounding makes every comparison exact, and 0.001 of a
 * rubric point is far finer than the judge can distinguish.
 */
const SCALE = 1000

/**
 * The cost of an edge, and the ceiling that makes filling a shot beat polishing
 * one. Any score in 0..10 scaled by 1000 is at most 10000, so subtracting from
 * this keeps every cost positive without ever reordering two edges.
 */
const MAX_COST = 20_000

type Graph = {
  /** Head of the adjacency list per node, or -1. */
  readonly head: Int32Array
  /** Paired arrays, edge `e` and its residual `e ^ 1`. */
  readonly to: number[]
  readonly next: number[]
  readonly cap: number[]
  readonly cost: number[]
}

function addEdge(g: Graph, from: number, to: number, cap: number, cost: number): void {
  g.to.push(to)
  g.cap.push(cap)
  g.cost.push(cost)
  g.next.push(g.head[from] ?? -1)
  g.head[from] = g.to.length - 1

  g.to.push(from)
  g.cap.push(0)
  g.cost.push(-cost)
  g.next.push(g.head[to] ?? -1)
  g.head[to] = g.to.length - 1
}

/**
 * Choose one picture per shot, spending each picture at most once, so that the
 * film shows as many shots as possible and then scores as highly as possible.
 *
 * Returns `sceneIndex -> key` and OMITS any scene it could not fill. An absent
 * scene means "nothing at or above the gate was left for it", which the caller
 * renders as a text card exactly as it does today.
 *
 * ##########################################################################
 * # SUCCESSIVE SHORTEST PATH, AND NO DEPENDENCY, DELIBERATELY.              #
 * #                                                                        #
 * # The largest film on the box is 166 shots against 318 distinct pictures  #
 * # with about 1600 edges. `munkres-js` is dense Hungarian over a matrix    #
 * # that would have to be padded with sentinel costs for every missing      #
 * # edge, which is more code than this file and slower on a sparse graph.   #
 * # `graphology` has no min-cost flow at all. An LP solver is absurd here.  #
 * #                                                                        #
 * # AUGMENTING ALONG THE CHEAPEST PATH EACH TIME is what gives both halves  #
 * # of the objective in one pass: the loop runs until no augmenting path    #
 * # exists, so the flow is MAXIMUM, which maximises shots filled; and each  #
 * # augmentation is the cheapest available, so among all maximum flows the  #
 * # total cost is MINIMUM, which maximises the summed score. Nothing has to #
 * # weight the two against each other, and there is no tuning constant.     #
 * ##########################################################################
 */
export function assignPictures(
  candidates: readonly AssignmentCandidate[],
  options: AssignmentOptions,
): Map<number, string> {
  const reserved = options.reserved ?? new Set<string>()

  /*
   * ##########################################################################
   * # SORTED BEFORE ANYTHING IS BUILT, AND THIS IS THE DETERMINISM GUARD.     #
   * #                                                                        #
   * # Vision scores are whole numbers, so ties are everywhere, and a min-cost #
   * # flow may return ANY of the equally cheap optima. Which one it returns   #
   * # depends entirely on the order the edges were added. If the caller's row #
   * # order could reach the answer, the same job would render a different     #
   * # film on a second run, every segment cache key would move, and no two    #
   * # review cuts would be comparable. That was the top-ranked risk on this   #
   * # change and it is answered here rather than by asking callers to sort.   #
   * ##########################################################################
   */
  const eligible = candidates
    .filter((row) => row.score >= options.gate && !reserved.has(row.key))
    .sort(
      (a, b) =>
        a.sceneIndex - b.sceneIndex ||
        b.score - a.score ||
        (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
    )

  const scenes = [...new Set(eligible.map((row) => row.sceneIndex))].sort((a, b) => a - b)
  const keys = [...new Set(eligible.map((row) => row.key))].sort()
  if (scenes.length === 0 || keys.length === 0) return new Map()

  const sceneNode = new Map(scenes.map((scene, i) => [scene, 1 + i]))
  const keyNode = new Map(keys.map((key, i) => [key, 1 + scenes.length + i]))
  const nodes = 2 + scenes.length + keys.length
  const source = 0
  const sink = nodes - 1

  const graph: Graph = {
    head: new Int32Array(nodes).fill(-1),
    to: [],
    next: [],
    cap: [],
    cost: [],
  }

  for (const scene of scenes) addEdge(graph, source, sceneNode.get(scene) ?? 0, 1, 0)
  for (const key of keys) addEdge(graph, keyNode.get(key) ?? 0, sink, 1, 0)
  for (const row of eligible) {
    addEdge(
      graph,
      sceneNode.get(row.sceneIndex) ?? 0,
      keyNode.get(row.key) ?? 0,
      1,
      MAX_COST - Math.round(row.score * SCALE),
    )
  }

  /*
   * Bellman-Ford rather than Dijkstra with potentials, because the residual
   * edges carry negative costs and this graph is small enough that the simpler
   * algorithm is the right trade. The queue is FIFO and every comparison is a
   * strict integer `<`, so an equal-cost path never displaces the one already
   * found and the whole pass is a pure function of the edge order fixed above.
   */
  for (;;) {
    const dist = new Array<number>(nodes).fill(Number.POSITIVE_INFINITY)
    const inQueue = new Array<boolean>(nodes).fill(false)
    const via = new Int32Array(nodes).fill(-1)
    dist[source] = 0
    const queue: number[] = [source]
    inQueue[source] = true

    while (queue.length > 0) {
      const node = queue.shift() ?? 0
      inQueue[node] = false
      for (let e = graph.head[node] ?? -1; e !== -1; e = graph.next[e] ?? -1) {
        const capacity = graph.cap[e] ?? 0
        if (capacity <= 0) continue
        const target = graph.to[e] ?? 0
        const relaxed = (dist[node] ?? 0) + (graph.cost[e] ?? 0)
        if (relaxed < (dist[target] ?? Number.POSITIVE_INFINITY)) {
          dist[target] = relaxed
          via[target] = e
          if (!inQueue[target]) {
            inQueue[target] = true
            queue.push(target)
          }
        }
      }
    }

    if (dist[sink] === Number.POSITIVE_INFINITY) break

    for (let node = sink; node !== source; ) {
      const e = via[node] ?? -1
      graph.cap[e] = (graph.cap[e] ?? 0) - 1
      graph.cap[e ^ 1] = (graph.cap[e ^ 1] ?? 0) + 1
      node = graph.to[e ^ 1] ?? source
    }
  }

  /*
   * READ BACK OFF THE RESIDUALS. A scene-to-key edge carries flow when its own
   * capacity is spent and its residual holds it, which is the only way to tell
   * a used edge from one that was never eligible.
   */
  const chosen = new Map<number, string>()
  for (const scene of scenes) {
    for (let e = graph.head[sceneNode.get(scene) ?? 0] ?? -1; e !== -1; e = graph.next[e] ?? -1) {
      const target = graph.to[e] ?? 0
      if (target <= scenes.length || target === sink) continue
      if ((graph.cap[e] ?? 0) === 0 && (graph.cap[e ^ 1] ?? 0) === 1) {
        chosen.set(scene, keys[target - 1 - scenes.length] ?? '')
        break
      }
    }
  }
  return chosen
}
