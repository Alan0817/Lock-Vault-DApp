"use client";
import type { PostMethodArgs, MethodCallResponse, TransactionToSignResponse, Event } from "@curvegrid/multibaas-sdk";
import type { SendTransactionParameters } from "@wagmi/core";
import { Configuration, ContractsApi, EventsApi, ChainsApi } from "@curvegrid/multibaas-sdk";
import { useAccount } from "wagmi";
import { useCallback, useMemo, useState } from "react";

interface ChainStatus {
  chainID: number;
  blockNumber: number;
}

interface MultiBaasHook {
  getChainStatus: () => Promise<ChainStatus | null>;
  getUnlockTime: () => Promise<bigint | null>;
  withdraw: () => Promise<SendTransactionParameters | null>;
  getWithdrawalEvents: () => Promise<Array<Event> | null>;
  isConfigured: boolean;
  lastError: string | null;
  callContractRead: (methodName: string, args?: any[]) => Promise<any>;
}

const useMultiBaas = (): MultiBaasHook => {
  const [lastError, setLastError] = useState<string | null>(null);

  // Get environment variables with fallbacks
  const mbBaseUrl = process.env.NEXT_PUBLIC_MULTIBAAS_DEPLOYMENT_URL || "";
  const mbApiKey = process.env.NEXT_PUBLIC_MULTIBAAS_DAPP_USER_API_KEY || "";
  const lockContractLabel = process.env.NEXT_PUBLIC_MULTIBAAS_CONTRACT_NAME || "Lock";
  const lockAddressAlias = process.env.NEXT_PUBLIC_MULTIBAAS_CONTRACT_ADDRESS || "";
  const chain = "ethereum";

  // Check if all required configuration values are present
  const isConfigured = Boolean(mbBaseUrl && mbApiKey && lockContractLabel && lockAddressAlias);

  // Log configuration for debugging
  console.log("MultiBaas Configuration:", {
    baseUrl: mbBaseUrl ? "Set" : "Missing",
    apiKey: mbApiKey ? "Set (value hidden)" : "Missing",
    contractLabel: lockContractLabel,
    addressAlias: lockAddressAlias,
    isConfigured
  });

  // Memoize mbConfig
  const mbConfig = useMemo(() => {
    if (!isConfigured) {
      console.warn("MultiBaas is not fully configured");
      return null;
    }
    try {
      return new Configuration({
        basePath: new URL("/api/v0", mbBaseUrl).toString(),
        accessToken: mbApiKey,
      });
    } catch (error) {
      console.error("Failed to create MultiBaas configuration:", error);
      setLastError("Failed to initialize MultiBaas configuration");
      return null;
    }
  }, [mbBaseUrl, mbApiKey, isConfigured]);

  // Memoize APIs
  const contractsApi = useMemo(() => mbConfig ? new ContractsApi(mbConfig) : null, [mbConfig]);
  const eventsApi = useMemo(() => mbConfig ? new EventsApi(mbConfig) : null, [mbConfig]);
  const chainsApi = useMemo(() => mbConfig ? new ChainsApi(mbConfig) : null, [mbConfig]);

  const { address, isConnected } = useAccount();

  const getChainStatus = async (): Promise<ChainStatus | null> => {
    if (!chainsApi) {
      console.error("Chain API not initialized");
      setLastError("Chain API not initialized");
      return null;
    }

    try {
      console.log("Fetching chain status...");
      const response = await chainsApi.getChainStatus(chain);
      console.log("Chain status response:", response.data);
      return response.data.result as ChainStatus;
    } catch (error: any) {
      console.error("Error getting chain status:", error);
      let errorMessage = "Error getting chain status";
      if (error.response) {
        errorMessage += `: ${error.response.status} ${error.response.statusText}`;
        console.error("API Error Response:", error.response.data);
      }
      setLastError(errorMessage);
      return null;
    }
  };

  const callContractRead = useCallback(
    async (methodName: string, args: PostMethodArgs['args'] = []): Promise<MethodCallResponse['output'] | null> => {
      if (!contractsApi) {
        console.error("Contracts API not initialized");
        setLastError("Contracts API not initialized");
        return null;
      }

      try {
        console.log(`Calling contract read function: ${methodName}`, {
          chain,
          lockAddressAlias,
          lockContractLabel,
          args
        });

        const payload: PostMethodArgs = {
          args,
          contractOverride: true,
        };

        const response = await contractsApi.callContractFunction(
          chain,
          lockAddressAlias,
          lockContractLabel,
          methodName,
          payload
        );

        console.log(`Raw response from ${methodName}:`, response.data);

        if (response.data.result.kind === "MethodCallResponse") {
          console.log(`Method call response output:`, response.data.result.output);
          return response.data.result.output;
        } else {
          const error = `Unexpected response type for read call: ${response.data.result.kind}`;
          console.error(error, response.data);
          setLastError(error);
          return null;
        }
      } catch (error: any) {
        console.error(`Error calling contract read function ${methodName}:`, error);
        let errorMessage = `Error calling contract read function ${methodName}`;
        if (error.response) {
          errorMessage += `: ${error.response.status} ${error.response.statusText}`;
          console.error("API Error Response:", error.response.data);
        } else if (error.message) {
          errorMessage += `: ${error.message}`;
        }
        setLastError(errorMessage);
        return null;
      }
    },
    [contractsApi, chain, lockAddressAlias, lockContractLabel]
  );

  const callContractSend = useCallback(
    async (methodName: string, args: PostMethodArgs['args'] = []): Promise<SendTransactionParameters | null> => {
      if (!contractsApi) {
        console.error("Contracts API not initialized");
        setLastError("Contracts API not initialized");
        return null;
      }

      if (!isConnected || !address) {
        console.error("Wallet not connected");
        setLastError("Wallet not connected");
        return null;
      }

      try {
        console.log(`Calling contract send function: ${methodName}`, {
          chain,
          lockAddressAlias,
          lockContractLabel,
          args,
          from: address
        });

        const payload: PostMethodArgs = {
          args,
          contractOverride: true,
          from: address,
        };

        const response = await contractsApi.callContractFunction(
          chain,
          lockAddressAlias,
          lockContractLabel,
          methodName,
          payload
        );

        console.log(`Raw response from ${methodName} send call:`, response.data);

        if (response.data.result.kind === "TransactionToSignResponse") {
          const txParams = {
            to: response.data.result.tx.to?.startsWith("0x") ? response.data.result.tx.to as `0x${string}` : null,
            data: response.data.result.tx.data?.startsWith("0x") ? response.data.result.tx.data as `0x${string}` : undefined,
            value: response.data.result.tx.value?.startsWith("0x") ? BigInt(response.data.result.tx.value) : undefined,
          };
          console.log("Transaction parameters:", txParams);
          return txParams;
        } else {
          const error = `Unexpected response type for send call: ${response.data.result.kind}`;
          console.error(error, response.data);
          setLastError(error);
          return null;
        }
      } catch (error: any) {
        console.error(`Error calling contract send function ${methodName}:`, error);
        let errorMessage = `Error calling contract send function ${methodName}`;
        if (error.response) {
          errorMessage += `: ${error.response.status} ${error.response.statusText}`;
          console.error("API Error Response:", error.response.data);
        } else if (error.message) {
          errorMessage += `: ${error.message}`;
        }
        setLastError(errorMessage);
        return null;
      }
    },
    [contractsApi, chain, lockAddressAlias, lockContractLabel, isConnected, address]
  );

  const getUnlockTime = useCallback(async (): Promise<bigint | null> => {
    console.log("Starting getUnlockTime function");
    try {
      const result = await callContractRead("unlockTime");
      console.log("Raw result from unlockTime:", result);
      
      if (result === null) {
        console.warn("Contract read returned null");
        return null;
      }
      
      if (typeof result === 'string') {
        console.log("Converting string result to BigInt:", result);
        try {
          return BigInt(result);
        } catch (error) {
          console.error("Failed to convert string to BigInt:", error);
          setLastError(`Failed to convert string to BigInt: ${result}`);
          return null;
        }
      } else if (typeof result === 'object' && result && 'hex' in result) {
        console.log("Converting hex object to BigInt:", result.hex);
        try {
          return BigInt(result.hex);
        } catch (error) {
          console.error("Failed to convert hex to BigInt:", error);
          setLastError(`Failed to convert hex to BigInt: ${result.hex}`);
          return null;
        }
      } else {
        console.error("Invalid result format from unlockTime:", result);
        setLastError(`Invalid result format from unlockTime: ${JSON.stringify(result)}`);
        return null;
      }
    } catch (error: any) {
      console.error("Error in getUnlockTime:", error);
      setLastError(`Error in getUnlockTime: ${error.message || 'Unknown error'}`);
      return null;
    }
  }, [callContractRead]);

  const withdraw = useCallback(async (): Promise<SendTransactionParameters | null> => {
    console.log("Starting withdraw function");
    try {
      return await callContractSend("withdraw");
    } catch (error: any) {
      console.error("Error in withdraw:", error);
      setLastError(`Error in withdraw: ${error.message || 'Unknown error'}`);
      return null;
    }
  }, [callContractSend]);

  const getWithdrawalEvents = useCallback(async (): Promise<Array<Event> | null> => {
    if (!eventsApi) {
      console.error("Events API not initialized");
      setLastError("Events API not initialized");
      return null;
    }

    try {
      console.log("Fetching withdrawal events...");
      const eventSignature = "Withdrawal(uint256,uint256)";
      console.log("Event parameters:", {
        chain,
        lockAddressAlias,
        lockContractLabel,
        eventSignature
      });
      
      const response = await eventsApi.listEvents(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        chain,
        lockAddressAlias,
        lockContractLabel,
        eventSignature,
        50
      );
      
      console.log("Withdrawal events response:", response.data);
      return response.data.result;
    } catch (error: any) {
      console.error("Error getting withdrawal events:", error);
      let errorMessage = "Error getting withdrawal events";
      if (error.response) {
        errorMessage += `: ${error.response.status} ${error.response.statusText}`;
        console.error("API Error Response:", error.response.data);
      } else if (error.message) {
        errorMessage += `: ${error.message}`;
      }
      setLastError(errorMessage);
      return null;
    }
  }, [eventsApi, chain, lockAddressAlias, lockContractLabel]);

  // Method to test API connection
  const testConnection = useCallback(async (): Promise<boolean> => {
    try {
      console.log("Testing MultiBaas connection...");
      const status = await getChainStatus();
      console.log("Connection test result:", status ? "Success" : "Failed");
      return status !== null;
    } catch (error) {
      console.error("Connection test failed:", error);
      setLastError("Connection test failed");
      return false;
    }
  }, [getChainStatus]);

  return {
    getChainStatus,
    getUnlockTime,
    withdraw,
    getWithdrawalEvents,
    isConfigured,
    lastError,
    callContractRead
  };
};

export default useMultiBaas;