import crypto from 'crypto';
import { Job, JobPayload } from '../../shared/types.js';

export interface ExecutionResult {
  output: any;
  summary: string;
  executionTimeMs: number;
  inputHash: string;
  resultHash: string;
}

export class ExecutionEngine {
  public static async execute(job: Job): Promise<ExecutionResult> {
    const startTime = performance.now();
    const payload = job.payload || {};

    let output: any = null;
    let summary = '';

    switch (job.type) {
      case 'PRIME_CALC': {
        const target = payload.targetNumber || 50000;
        const primes: number[] = [];
        for (let i = 2; i <= target; i++) {
          let isPrime = true;
          const sqrt = Math.sqrt(i);
          for (let j = 2; j <= sqrt; j++) {
            if (i % j === 0) {
              isPrime = false;
              break;
            }
          }
          if (isPrime) primes.push(i);
        }
        output = {
          count: primes.length,
          lastPrime: primes[primes.length - 1] || 0,
          sample: primes.slice(-10),
        };
        summary = `Calculated ${primes.length} prime numbers up to ${target}. Highest prime: ${output.lastPrime}`;
        break;
      }

      case 'FIBONACCI': {
        const n = Math.min(payload.targetNumber || 40, 45); // cap for safety
        const fib = (num: number): number => {
          let a = 0, b = 1, temp = 0;
          for (let i = 2; i <= num; i++) {
            temp = a + b;
            a = b;
            b = temp;
          }
          return num === 0 ? a : b;
        };
        const resultVal = fib(n);
        output = { n, value: resultVal };
        summary = `Computed ${n}th Fibonacci number: ${resultVal}`;
        break;
      }

      case 'SORTING': {
        const size = Math.min(payload.arraySize || 100000, 500000);
        const arr = new Float64Array(size);
        for (let i = 0; i < size; i++) {
          arr[i] = Math.random() * 1000000;
        }
        // Perform Float64 sort
        arr.sort();
        output = {
          elementCount: size,
          min: arr[0],
          max: arr[size - 1],
          median: arr[Math.floor(size / 2)],
        };
        summary = `Sorted array of ${size.toLocaleString()} 64-bit numbers. Min: ${arr[0].toFixed(2)}, Max: ${arr[size - 1].toFixed(2)}`;
        break;
      }

      case 'MATRIX_OPS': {
        const dim = Math.min(payload.matrixSize || 150, 300);
        // Multiply two dim x dim matrices
        const A = Array.from({ length: dim }, () => Array.from({ length: dim }, () => Math.random()));
        const B = Array.from({ length: dim }, () => Array.from({ length: dim }, () => Math.random()));
        const C = Array.from({ length: dim }, () => new Float64Array(dim));

        for (let i = 0; i < dim; i++) {
          for (let k = 0; k < dim; k++) {
            const aik = A[i][k];
            for (let j = 0; j < dim; j++) {
              C[i][j] += aik * B[k][j];
            }
          }
        }

        let totalSum = 0;
        for (let i = 0; i < dim; i++) {
          for (let j = 0; j < dim; j++) {
            totalSum += C[i][j];
          }
        }

        output = {
          dimensions: `${dim}x${dim}`,
          matrixCellCount: dim * dim,
          accumulatedSum: totalSum.toFixed(4),
        };
        summary = `Multiplied two ${dim}x${dim} dense matrices (${(dim * dim).toLocaleString()} ops). Checksum sum: ${totalSum.toFixed(2)}`;
        break;
      }

      case 'HASH_CALC': {
        const iterations = Math.min(payload.iterations || 20000, 100000);
        let currentHash = crypto.createHash('sha256').update(job.id + JSON.stringify(payload)).digest('hex');
        for (let i = 0; i < iterations; i++) {
          currentHash = crypto.createHash('sha256').update(currentHash + i).digest('hex');
        }
        output = {
          rounds: iterations,
          finalHash: currentHash,
        };
        summary = `Executed ${iterations.toLocaleString()} rounds of SHA-256 hash chaining. Final digest: ${currentHash.substring(0, 16)}...`;
        break;
      }

      case 'DATA_PROCESSING': {
        const records = Math.min(payload.arraySize || 50000, 200000);
        let totalVal = 0;
        let anomalyCount = 0;
        const categories = ['sensor-a', 'sensor-b', 'sensor-c', 'sensor-d'];
        const catStats: Record<string, { count: number; sum: number }> = {};
        categories.forEach((c) => (catStats[c] = { count: 0, sum: 0 }));

        for (let i = 0; i < records; i++) {
          const val = Math.random() * 100;
          const cat = categories[i % categories.length];
          catStats[cat].count++;
          catStats[cat].sum += val;
          totalVal += val;
          if (val > 95) anomalyCount++;
        }

        output = {
          processedRecords: records,
          avgValue: (totalVal / records).toFixed(2),
          anomaliesDetected: anomalyCount,
          breakdown: catStats,
        };
        summary = `Processed ${records.toLocaleString()} telemetry streams. Detected ${anomalyCount} high-threshold anomalies. Avg telemetry: ${(totalVal / records).toFixed(2)}`;
        break;
      }

      case 'AI_INFERENCE': {
        const layers = Math.min(payload.iterations || 10, 30);
        const featureDim = 128;
        let vec = Array.from({ length: featureDim }, () => Math.random());

        for (let l = 0; l < layers; l++) {
          const nextVec = new Array(featureDim).fill(0);
          for (let i = 0; i < featureDim; i++) {
            let sum = 0;
            for (let j = 0; j < featureDim; j++) {
              sum += vec[j] * Math.sin(i * j + l);
            }
            // ReLU / Softmax activation
            nextVec[i] = Math.max(0, sum / featureDim);
          }
          vec = nextVec;
        }

        // Softmax
        const expSum = vec.reduce((acc, v) => acc + Math.exp(v), 0);
        const probabilities = vec.map((v) => Math.exp(v) / expSum);
        const topClass = probabilities.indexOf(Math.max(...probabilities));

        output = {
          networkLayers: layers,
          featureDimensions: featureDim,
          predictedClass: topClass,
          confidenceScore: (probabilities[topClass] * 100).toFixed(2) + '%',
        };
        summary = `Evaluated ${layers}-layer tensor activation pipeline. Predicted Class #${topClass} with ${output.confidenceScore} confidence`;
        break;
      }

      default: {
        summary = `Executed basic generic compute task for job ${job.id}`;
        output = { status: 'OK' };
      }
    }

    const endTime = performance.now();
    const executionTimeMs = Math.round(endTime - startTime);

    const inputHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(job.payload))
      .digest('hex');

    const resultHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(output) + executionTimeMs)
      .digest('hex');

    return {
      output,
      summary,
      executionTimeMs,
      inputHash,
      resultHash,
    };
  }
}
