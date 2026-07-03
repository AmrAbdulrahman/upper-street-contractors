type StrapiRequestCounters = {
  graphql: number
  rest: number
}

const COUNTERS_KEY = '__strapiRequestCounters'

function getCounters(): StrapiRequestCounters {
  const globalStore = globalThis as typeof globalThis & {
    [COUNTERS_KEY]?: StrapiRequestCounters
  }

  if (!globalStore[COUNTERS_KEY]) {
    globalStore[COUNTERS_KEY] = { graphql: 0, rest: 0 }
  }

  return globalStore[COUNTERS_KEY]!
}

function logCounters(): void {
  const { graphql, rest } = getCounters()
  console.log(`[Strapi] GraphQL requests: ${graphql} | REST requests: ${rest}`)
}

export function incrementGraphqlRequestCount(): number {
  const counters = getCounters()
  counters.graphql += 1
  logCounters()
  return counters.graphql
}

export function incrementRestRequestCount(): number {
  const counters = getCounters()
  counters.rest += 1
  logCounters()
  return counters.rest
}

export function getStrapiRequestCounts(): Readonly<StrapiRequestCounters> {
  return { ...getCounters() }
}
