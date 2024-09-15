const STARTING_ENERGY = 1000
const MICROB_ENERGY_CONSUMP = 20 // 20 per iteration
const MICROB_ENERGY_USAGE = 5 // 10 per iteration yielding 10 net energy increase for normal scenario 
const ENERGY_INC_RATE = 200 // 50 in every iteration
const MICROB_ENERGY_FOR_REPROD = 10

const MUTATION_RATE = 0.5 // once in every 2 generation

const AREA_LEN = 500
const MICROBE_SENSE_RADIUS = 50
const MICROBE_MIN_RADIUS = 5

const STARTING_MICROBE_NUM = 2
const STARTING_MICROBE_GENES = new Array(20).fill(0) // 20 genes in genome

const STARTING_PH = 4.7
const PH_INC_RATE = 0.005 // per iteration

let ENVIRONMENT = {
    energy: STARTING_ENERGY,
    ph: STARTING_PH
}
let MICROBS = new Array(STARTING_MICROBE_NUM).fill({})
let focusGeneIdx = 0


// DATA COLLECTION

let iterations = []


const initializeGenes = () => {
    STARTING_MICROBE_GENES[focusGeneIdx] = 0

    let i = Math.floor(Math.random() * 20)
    STARTING_MICROBE_GENES[i] = { optimalPH: 5 } // configure a random gene for PH
    focusGeneIdx = i
    initializeMicrobs() // create the microbes
}

const initializeMicrobs = () => {
    MICROBS.forEach((el, i) => {
        let pos = { x: Math.floor(Math.random() * 500), y: Math.floor(Math.random() * 500) }
        MICROBS[i] = {
            pos,
            genes: STARTING_MICROBE_GENES,
            energy: 0,
            isDying: false,
            isMutating: false
        }
    })
}

const calculateCrowdDensity = (microbe, isCompetition=false) => {
    let neighbors = 0

    MICROBS.forEach((other) => {

        if (other !== microbe) {

            // calculate distance to nearby microbe
            const distance = Math.sqrt(
                Math.pow(microbe.pos.x - other.pos.x, 2) + Math.pow(microbe.pos.y - other.pos.y, 2)
            )
            // check it it's really close
            if (isCompetition) {
                if (distance <= MICROBE_MIN_RADIUS) {
                    neighbors++
                }
            } else {
                if (distance <= MICROBE_SENSE_RADIUS) {
                    neighbors++
                }
            }
            
        }
    })

    return neighbors
}

const moveMicrobe = (microbe) => {
    const directions = [
        { x: 2, y: 1 },
        { x: -2, y: 1 },
        { x: 1, y: 2 },
        { x: 1, y: -2 },
    ]

    let bestDirection = null
    let lowestCrowd = Infinity

    directions.forEach((dir) => {
        // randomize position
        const randomMoveX = (Math.random() * 20 * 2) - 20
        const randomMoveY = (Math.random() * 20 * 2) - 20

        const newPos = {
            x: Math.min(Math.max(microbe.pos.x + dir.x * randomMoveX, 0), AREA_LEN),
            y: Math.min(Math.max(microbe.pos.y + dir.y * randomMoveY, 0), AREA_LEN),
        }

        // calculate crowd density
        let tempMicrobe = { pos: newPos }
        let crowd = calculateCrowdDensity(tempMicrobe)

        // check if it's the best direction
        if (crowd < lowestCrowd) {
            lowestCrowd = crowd
            bestDirection = newPos
        }
    })

    // move to the best direction
    if (bestDirection) {
        microbe.pos = bestDirection
    }
}


const canvas = document.getElementById('canvas')
const ctx = canvas.getContext('2d')
const draw = () => {
    ctx.clearRect(0, 0, 500, 500)
    MICROBS.forEach((el, i) => {
        if (el.isDying) {
            ctx.fillStyle = 'red'
        }
        else
            if (el.isMutating) {
                ctx.fillStyle = 'blue'
            }

        ctx.fillRect(el.pos.x, el.pos.y, 5, 5)

        ctx.fillStyle = 'black'
    })
}


let j = 0
const iterate = () => {
    let i = 1
    let totalMicrobes = 0,
        positiveMut = 0,
        negativeMut = 0,
        iterationPhSum = 0,
        phList = [],
        populationList = []

    let interval = setInterval(() => {
        totalMicrobes += MICROBS.length
        ENVIRONMENT.energy = ENVIRONMENT.energy + ENERGY_INC_RATE
        ENVIRONMENT.ph = parseFloat((ENVIRONMENT.ph + PH_INC_RATE).toFixed(3))

        if (Math.random() < 0.01) {
            MICROBS = MICROBS.slice(0, Math.floor(MICROBS.length * 0.2)) // random disaster for genetic drift
        }

        let len = MICROBS.length
        for (let i = 0; i < len; i++) {
            let el = MICROBS[i]

            if (el?.isMutating) {
                MICROBS[i].isMutating = false
            }

            // kill the microbe
            if (el?.isDying || el === undefined) {
                MICROBS = MICROBS.filter((v, idx) => idx !== i)
                continue
            }

            // Natural Selection: the microbe will die if the environment PH doesn't match its optimal PH or if it has run out of energy
            if (ENVIRONMENT.ph + 0.4 <= el.genes[focusGeneIdx].optimalPH ||
                ENVIRONMENT.ph - 0.4 >= el.genes[focusGeneIdx].optimalPH ||
                el.energy < 0
            ) {
                if (el.energy > 0) ENVIRONMENT.energy += el.energy - 2 // dead microbe will decompose in environment
                MICROBS[i].isDying = true
                continue
            }

            // the microbe will reproduce if it has enough energy or in some rare cases without enough energy for genetic drift
            if (Math.random() < 0.05 || el.energy >= MICROB_ENERGY_FOR_REPROD) {
                let daughter = structuredClone(el)

                // mutation occurs in 2 genes each time
                for (let k = 0; k < 2; k++) {
                    let gi = Math.floor(Math.random() * 20) // mutation occurs in a random gene

                    if (gi === focusGeneIdx) { // we only care about the ph gene here
                        MICROBS[i].isMutating = true
                        let mutatedVal = daughter.genes[focusGeneIdx].optimalPH + Math.random().toFixed(3) * 2 - 1

                        if (daughter.genes[focusGeneIdx].optimalPH < mutatedVal) positiveMut++
                        else negativeMut++

                        daughter.genes[focusGeneIdx].optimalPH = mutatedVal
                    }
                }

                // energy distribution after reproduction

                MICROBS[i].energy -= MICROB_ENERGY_FOR_REPROD
                daughter.energy = (MICROBS[i].energy / 2)
                MICROBS[i].energy = (MICROBS[i].energy / 2)

                // daughter microbe is born
                MICROBS.push(daughter)
            }

            // energy for microbe
            if (ENVIRONMENT.energy - MICROB_ENERGY_CONSUMP > 0) {
                let crowd = calculateCrowdDensity(el, true) 
                let factor = 1
                if (crowd > 0) factor = crowd 
                MICROBS[i].energy += (MICROB_ENERGY_CONSUMP / factor)
                ENVIRONMENT.energy -= (MICROB_ENERGY_CONSUMP / factor)
            }

            MICROBS[i].energy -= MICROB_ENERGY_USAGE // energy is always used regardless how much is consumed


            // movement for microbe
            moveMicrobe(el)

            // check for successful species
            if (el.genes[focusGeneIdx].optimalPH >= 6) {
                console.log('SUCCESSFULLY CREATED NEW SPECIES WITH ', el)
            }

        }

        MICROBS.forEach(el => iterationPhSum += el.genes[focusGeneIdx].optimalPH)
        phList.push({generation: i, meanPh: parseFloat((iterationPhSum/MICROBS.length).toFixed(3))})
        iterationPhSum = 0

        populationList.push({ generation: i, microbeCount: MICROBS.length })
        
        if (MICROBS.length === 0) {
            clearInterval(interval)
            console.log('FAILED AT GEN: ', i)
            iterations.push({ failedGeneration: i, finalPH: ENVIRONMENT.ph, 
                avgMicrobeCount: totalMicrobes/i, 
                avgPositiveMutations: positiveMut/i, avgNegativeMutations: negativeMut/i,
                optimalPHTrend: phList,
                populationTrend: populationList
            })
            nextIteration()
            return
        }

        if (ENVIRONMENT.ph == 7) {
            clearInterval(interval)
            iterations.push({ finalGeneration: i, finalPH: ENVIRONMENT.ph, 
                avgMicrobeCount: totalMicrobes/i, 
                avgPositiveMutations: positiveMut/i, avgNegativeMutations: negativeMut/i,
                optimalPHTrend: phList,
                populationTrend: populationList
            })
            nextIteration()
            return
        }
        console.log(i, ENVIRONMENT, MICROBS.length)
        draw()
        i++
    }, 125)
}


const phctx = document.getElementById('phchart')
const popctx = document.getElementById('popchart')
const nextIteration = () => {

    new Chart(phctx, {
        type: 'line',
        data: {
          labels: iterations[j].optimalPHTrend.map(o => o.generation),
          datasets: [{
            label: 'Optimal PH',
            data: iterations[j].optimalPHTrend.map(o => o.meanPh),
            borderWidth: 1
          }],
          fill: false,
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1
        }
    })

    new Chart(popctx, {
        type: 'line',
        data: {
          labels: iterations[j].optimalPHTrend.map(o => o.generation),
          datasets: [
          {
            label: 'Population',
            data: iterations[j].populationTrend.map(o => o.microbeCount),
            borderWidth: 1
          }],
          fill: false,
          borderColor: '#FF7514',
          tension: 0.1
        }
    })

    if (j === 1) {
        console.log(iterations)
        return
    }

    MICROBS = new Array(STARTING_MICROBE_NUM).fill({})
    ENVIRONMENT = {
        energy: STARTING_ENERGY,
        ph: STARTING_PH
    }
    
    j++
    initializeGenes()
    iterate()
}   

initializeGenes()
iterate()

  