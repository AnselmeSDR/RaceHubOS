import { analysedLaps, gapsTo } from './lapStats'

const laps = (...times) => times.map((lapTime, i) => ({ lapNumber: i + 1, lapTime }))
const entry = (id, ...times) => ({ id, controller: 0, driver: { name: id }, laps: laps(...times) })

test('a clean lap is within 15 % of the best; the others are incidents, costing their time over a median lap', () => {
  // 11500 is still clean (the limit itself), 11501 no longer is
  const [ana] = analysedLaps([entry('ana', 10000, 10400, 11500, 11501, 20000)])
  expect(ana).toMatchObject({ best: 10000, limit: 11500, median: 10400, incidents: 2, lost: 1101 + 9600 })
  expect(ana.times).toEqual([10000, 10400, 11500, 11501, 20000])
})

test('the spread is the standard deviation of the clean laps only', () => {
  const [ana] = analysedLaps([entry('ana', 9000, 9200, 9400, 30000)])
  expect(ana.spread).toBeCloseTo(163.3, 1)
  expect(analysedLaps([entry('solo', 9000)])[0]).toMatchObject({ spread: 0, incidents: 0, lost: 0 })
})

test('the pace is the median of each clean lap and its clean neighbours, a straight line across an incident', () => {
  const [ana] = analysedLaps([entry('ana', 20000, 9000, 9100, 15000, 15000, 9400, 9200, 9300, 9000, 14000)])
  expect(ana.pace).toEqual(
    [
      null, // before the first clean lap
      9100, // 9000, 9100, 9400
      9150, // 9000, 9100, 9400, 9200
      9167, // a third of the way from 9150 to 9200
      9183,
      9200, // 9000, 9100, 9400, 9200, 9300
      9200, // 9100, 9400, 9200, 9300, 9000
      9250, // 9400, 9200, 9300, 9000
      9200, // 9200, 9300, 9000
      null, // after the last one
    ].map((time) => (time === null ? null : expect.closeTo(time, 0)))
  )
})

test('the laps are read in lap order, and the time elapsed adds them up', () => {
  const [ana] = analysedLaps([
    {
      controller: 3,
      driver: null,
      laps: [
        { lapNumber: 2, lapTime: 9500 },
        { lapNumber: 1, lapTime: 9000 },
      ],
    },
  ])
  expect(ana).toMatchObject({ key: 'ctrl-3', controller: 3, times: [9000, 9500], elapsed: [9000, 18500] })
})

test('who has not lapped is left out, the others keep their order', () => {
  const drivers = analysedLaps([entry('ana', 9000), { id: 'ben', laps: [] }, { id: 'cid' }, entry('dan', 9100)])
  expect(drivers.map((driver) => driver.key)).toEqual(['ana', 'dan'])
})

test('the gap to the leader at the end of each lap both have done: ahead is negative', () => {
  const [ana, ben] = analysedLaps([entry('ana', 9000, 9000, 9000), entry('ben', 8800, 9500, 9100, 9000)])
  expect(gapsTo(ana, ben)).toEqual([-200, 300, 400])
  expect(gapsTo(ben, ana)).toEqual([200, -300, -400])
  expect(gapsTo(ana, ana)).toEqual([0, 0, 0])
})
