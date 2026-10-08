/**
 * WORDS A LINE MAY NOT END ON, BECAUSE THEY POINT AT SOMETHING THAT IS NOT
 * THERE.
 *
 * ##########################################################################
 * # TWO READERS, ONE LIST. Moved here out of `visualPlan.ts`, 2026-09-12.  #
 * #                                                                        #
 * # `toLastWord` in `visualPlan.ts` strips these off the end of a line it  #
 * # had to trim. `endsMidPhrase` in `deviceChoice.ts` refuses a P03 line   #
 * # that ends on one, trimmed or not. Until now the chooser kept a shorter #
 * # list of its own, and job-v9's kicker "Not sleep or" drew at 6:00.2     #
 * # because "or" was on this list and not on that one.                     #
 * #                                                                        #
 * # ITS OWN FILE, AND IT IMPORTS NOTHING. `visualPlan.ts` already imports  #
 * # `JOINING_WORDS` from `deviceChoice.ts` as a value, so `deviceChoice.ts`#
 * # importing this list from `visualPlan.ts` would close a cycle between   #
 * # the two. A leaf that both of them import cannot.                       #
 * #                                                                        #
 * # NOT A COPY OF `JOINING_WORDS`. That set answers a different question,  #
 * # which words a caption may add WITHOUT the narration having said them,  #
 * # and the two would drift apart the moment either was tuned. This one    #
 * # answers "which words look broken at the END of a line". It holds every #
 * # joining word and more besides, such as "or", "than", "their" and "not".#
 * #                                                                        #
 * # OUTSIDE THE COMPOSITOR BUNDLE. Only `visualPlan.ts` and                 #
 * # `deviceChoice.ts` import it, the compositor reaches neither (trap SS,  #
 * # pinned by `bundleGraph.test.ts`), so `bundleHash` cannot move.          #
 * ##########################################################################
 */
export const DANGLING_WORDS: ReadonlySet<string> = new Set([
  'the', 'a', 'an', 'of', 'and', 'or', 'but', 'in', 'at', 'on', 'for', 'to',
  'from', 'by', 'with', 'as', 'into', 'onto', 'over', 'under', 'than', 'that',
  'this', 'these', 'those', 'its', 'his', 'her', 'their', 'our', 'your', 'is',
  'was', 'were', 'be', 'been', 'has', 'had', 'have', 'not',
])
