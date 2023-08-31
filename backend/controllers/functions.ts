import { Token, Percent } from '@pancakeswap/sdk';
import { Price } from '@pancakeswap/swap-sdk-core';
import { nearestUsableTick, TickMath, TICK_SPACINGS, FeeAmount, priceToClosestTick } from "@pancakeswap/v3-sdk";
import { Pool, encodeSqrtRatioX96 } from '@pancakeswap/v3-sdk';
import { createPublicClient, createWalletClient, http, getContract } from 'viem';
import { bsc } from 'viem/chains';
import { PancakeV3PoolABI } from "~/abi/PancakeV3Pool";
import { Currency, CurrencyAmount, Fraction } from '@pancakeswap/sdk'

const tryParsePrice = (baseToken?: Token, quoteToken?: Token, value?: string) => {
    if (!baseToken || !quoteToken || !value) {
        return undefined
    }

    if (!value.match(/^\d*\.?\d+$/)) {
        return undefined
    }

    const [whole, fraction] = value.split('.')

    const decimals = fraction?.length ?? 0
    const withoutDecimals = BigInt((whole ?? '') + (fraction ?? ''))

    return new Price(
        baseToken,
        quoteToken,
        BigInt(10 ** decimals) * BigInt(10 ** baseToken.decimals),
        withoutDecimals * BigInt(10 ** quoteToken.decimals),
    )
}

export const tryParseTick = (
    baseToken?: Token,
    quoteToken?: Token,
    feeAmount?: FeeAmount,
    value?: string,
): number | undefined => {
    if (!baseToken || !quoteToken || !feeAmount || !value) {
        return undefined
    }

    const price = tryParsePrice(baseToken, quoteToken, value)

    if (!price) {
        return undefined
    }

    let tick: number

    // check price is within min/max bounds, if outside return min/max
    const sqrtRatioX96 = encodeSqrtRatioX96(price.numerator, price.denominator)

    if (sqrtRatioX96 >= TickMath.MAX_SQRT_RATIO) {
        tick = TickMath.MAX_TICK
    } else if (sqrtRatioX96 <= TickMath.MIN_SQRT_RATIO) {
        tick = TickMath.MIN_TICK
    } else {
        // this function is agnostic to the base, will always return the correct tick
        tick = priceToClosestTick(price)
    }

    return nearestUsableTick(tick, TICK_SPACINGS[feeAmount])
}

const publicClient = createPublicClient({
    chain: bsc,
    transport: http(process.env.BSC_RPC_URL)
})

const walletClient = createWalletClient({
    chain: bsc,
    transport: http(process.env.BSC_RPC_URL)
})

export const getPool = (token0: Token, token1: Token, fee: any): Promise<Pool> => {
    return new Promise(async (resolve, reject) => {
        const v3Pool = getContract({ abi: PancakeV3PoolABI, address: `0x${process.env.BSC_V3POOL_ADDR}`, publicClient, walletClient });
        const slot0: any = await v3Pool.read.slot0();
        const [sqrtPriceX96, tick, , , , feeProtocol] = slot0;
        const liquidity: any = await v3Pool.read.liquidity();

        const pool = new Pool(token0, token1, fee, sqrtPriceX96, liquidity, tick);
        pool.feeProtocol = feeProtocol;

        resolve(pool);
    })
}

export const waitUntilGas = (wdata: any) => {
    return new Promise(async (resolve, reject) => {
        let tried = 0, done = false;

        do {
            try {
                const gas = await publicClient.estimateContractGas(wdata)
                console.log('gas:  ', gas);
                done = true;
                break;
            } catch (e) {
                tried++;
                console.log(`Transaction failed. ${tried} time(s) tried.`);
                await new Promise((res) => { setTimeout(res, 3000); });
            }
        } while (tried < 10);

        resolve(done);
    });
}

export function formatCurrencyAmount(
    amount: CurrencyAmount<Currency> | undefined,
    sigFigs: number,
    locale: string,
    fixedDecimals?: number,
): string {
    if (!amount) {
        return '-'
    }

    if (amount.quotient === BigInt(0)) {
        return '0'
    }

    if (amount.divide(amount.decimalScale).lessThan(new Fraction(1, 100000))) {
        return `<0.0001`
    }

    const baseString = parseFloat(amount.toSignificant(sigFigs))
    let numberString = fixedDecimals ? parseFloat(baseString.toFixed(fixedDecimals)) : baseString

    return numberString.toLocaleString(locale, {
        minimumFractionDigits: fixedDecimals,
        maximumFractionDigits: fixedDecimals,
        maximumSignificantDigits: fixedDecimals ? undefined : sigFigs,
    })
}