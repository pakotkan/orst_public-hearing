import data from '../data/ministries_th.json'

/**
 * Thai ministry names for the "related agency" dropdown, read from src/data/ministries_th.json.
 * Edit that file to change the list. The answer stores `name_th`, so names stay readable in the
 * database and in reports.
 */
export const MINISTRY_NAMES: readonly string[] = data.ministries_of_thailand.map((m) => m.name_th)
