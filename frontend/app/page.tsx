"use client";
import React, { useState, useEffect } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import useMultiBaas from "./useMultiBaas";

const Home: React.FC = () => {
  // State management
  const [unlockTime, setUnlockTime] = useState<bigint | null>(null);
  const [canWithdraw, setCanWithdraw] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [debugInfo, setDebugInfo] = useState<any>(null);

  // Wallet and MultiBaas hooks
  const { isConnected, address } = useAccount();
  const { 
    getUnlockTime, 
    withdraw, 
    isConfigured, 
    lastError, 
    getChainStatus,
    callContractRead
  } = useMultiBaas();

  // Check MultiBaas configuration on first load
  useEffect(() => {
    if (!isConfigured) {
      setError("MultiBaas is not properly configured. Please check your environment variables.");
      setDebugInfo({
        message: "MultiBaas configuration incomplete",
        timestamp: new Date().toISOString(),
        isConfigured
      });
    }
  }, [isConfigured]);

  // Sync error state with MultiBaas hook's lastError
  useEffect(() => {
    if (lastError) {
      setError(lastError);
    }
  }, [lastError]);

  // Fetch unlock time when wallet connection changes
  useEffect(() => {
    if (isConnected && isConfigured) {
      fetchUnlockTime();
    }
  }, [isConnected, isConfigured]);

  // Check if funds can be withdrawn whenever unlockTime changes
  useEffect(() => {
    if (unlockTime !== null) {
      const nowInSeconds = BigInt(Math.floor(Date.now() / 1000));
      console.log("Current time (seconds):", nowInSeconds.toString());
      console.log("Unlock time (seconds):", unlockTime.toString());
      setCanWithdraw(nowInSeconds >= unlockTime);
    }
  }, [unlockTime]);

  const fetchUnlockTime = async () => {
    try {
      console.log("Fetching unlock time...");
      setError("");
      setLoading(true);
      setDebugInfo(null);
      
      // Check environment variables directly
      console.log("Environment variables check:", {
        contractName: process.env.NEXT_PUBLIC_MULTIBAAS_CONTRACT_NAME,
        contractAddress: process.env.NEXT_PUBLIC_MULTIBAAS_CONTRACT_ADDRESS,
        deploymentUrl: process.env.NEXT_PUBLIC_MULTIBAAS_DEPLOYMENT_URL ? "Set" : "Missing",
      });
      
      // First test chain connection
      const chainStatus = await getChainStatus();
      if (!chainStatus) {
        throw new Error("Failed to connect to blockchain. Please check your network connection.");
      }
      console.log("Chain status successfully retrieved:", chainStatus);
      
      // Try to get direct contract call result
      console.log("Trying direct contract call...");
      const directResult = await callContractRead("unlockTime", []);
      console.log("Direct contract call result:", directResult);
      
      // Now try the getUnlockTime function
      console.log("Calling getUnlockTime function...");
      const unlock = await getUnlockTime();
      console.log("getUnlockTime response:", unlock);
      
      if (unlock !== null) {
        setUnlockTime(unlock);
        console.log("Unlock time set successfully:", unlock.toString());
      } else {
        console.error("getUnlockTime returned null");
        
        setDebugInfo({
          message: "Failed to fetch unlock time - null response",
          timestamp: new Date().toISOString(),
          walletConnected: isConnected,
          walletAddress: address,
          isConfigured: isConfigured,
          chainStatus: chainStatus,
          directResult: directResult
        });
        
        throw new Error("Failed to fetch unlock time");
      }
    } catch (err: any) {
      console.error("Error fetching unlock time:", err);
      setError(err.message || "An error occurred while fetching unlock time");
      
      // Try direct contract call even if previous steps failed
      try {
        const directResult = await callContractRead("unlockTime", []);
        console.log("Emergency direct contract call result:", directResult);
        
        setDebugInfo({
          message: err.message,
          stack: err.stack,
          timestamp: new Date().toISOString(),
          walletConnected: isConnected,
          walletAddress: address,
          isConfigured: isConfigured,
          emergencyCallResult: directResult
        });
      } catch (directErr: any) {
        setDebugInfo({
          message: err.message,
          stack: err.stack,
          timestamp: new Date().toISOString(),
          walletConnected: isConnected,
          walletAddress: address,
          isConfigured: isConfigured,
          emergencyCallError: directErr.message
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!isConnected) {
      setError("Please connect your wallet first");
      return;
    }

    try {
      console.log("Initiating withdrawal...");
      setError("");
      setLoading(true);
      setDebugInfo(null);
      
      const txParams = await withdraw();
      console.log("Withdraw result:", txParams);
      
      if (txParams && txParams.to && txParams.data) {
        setTxHash(txParams.to);
        console.log("Transaction parameters:", txParams);
      } else {
        throw new Error("Failed to initiate withdrawal");
      }
    } catch (err: any) {
      console.error("Error during withdrawal:", err);
      setError(err.message || "An error occurred while processing the withdrawal");
      
      setDebugInfo({
        message: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString(),
        walletConnected: isConnected,
        walletAddress: address
      });
    } finally {
      setLoading(false);
    }
  };

  // Test the configuration without requiring wallet connection
  const testConfiguration = async () => {
    try {
      setError("");
      setLoading(true);
      setDebugInfo(null);
      
      const status = await getChainStatus();
      
      if (status) {
        setDebugInfo({
          message: "MultiBaas connection successful",
          chainId: status.chainID,
          blockNumber: status.blockNumber,
          timestamp: new Date().toISOString()
        });
      } else {
        throw new Error("Failed to connect to MultiBaas");
      }
    } catch (err: any) {
      console.error("Configuration test failed:", err);
      setError(err.message || "Failed to test configuration");
      
      setDebugInfo({
        message: "Configuration test failed",
        error: err.message,
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  // Quick method tester
  const testMethod = async (method: string) => {
    try {
      setLoading(true);
      const result = await callContractRead(method, []);
      setDebugInfo({
        message: `Quick test of "${method}" method`,
        result: result,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      setDebugInfo({
        message: `Quick test of "${method}" method failed`,
        error: err.message,
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const showTester = isConnected && isConfigured;

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-8 bg-gray-100 p-4 rounded">
        <h1 className="text-2xl font-bold">Time-Locked Vault DApp</h1>
        <ConnectButton />
      </div>

      <div className="bg-white p-6 rounded shadow-md">
        {/* Configuration status */}
        {!isConfigured && (
          <div className="bg-orange-100 border border-orange-400 text-orange-700 px-4 py-3 rounded mb-4">
            <p className="font-bold">Configuration Warning:</p>
            <p>MultiBaas is not properly configured. Check your environment variables.</p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p className="font-bold">Error:</p>
            <p>{error}</p>
            <div className="flex space-x-2 mt-2">
              <button 
                onClick={() => fetchUnlockTime()} 
                className="px-3 py-1 bg-red-600 text-white rounded text-sm"
                disabled={loading}
              >
                Retry
              </button>
              <button 
                onClick={() => testConfiguration()} 
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                disabled={loading}
              >
                Test Connection
              </button>
            </div>
          </div>
        )}

        {/* Debug information */}
        {debugInfo && (
          <div className="bg-yellow-50 border border-yellow-400 text-yellow-800 px-4 py-3 rounded mb-4 overflow-auto">
            <div className="flex justify-between">
              <p className="font-bold">Debug Info:</p>
              <button 
                onClick={() => setDebugInfo(null)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            </div>
            <pre className="mt-2 text-xs">{JSON.stringify(debugInfo, null, 2)}</pre>
          </div>
        )}

        {/* Quick method tester buttons */}
        {isConnected && isConfigured && (
          <div className="mb-4 flex flex-wrap gap-2">
            <button 
              onClick={() => testMethod("unlockTime")}
              className="px-3 py-1 bg-gray-700 text-white rounded text-sm"
              disabled={loading}
            >
              Test unlockTime
            </button>
            <button 
              onClick={() => testMethod("owner")}
              className="px-3 py-1 bg-gray-700 text-white rounded text-sm"
              disabled={loading}
            >
              Test owner
            </button>
          </div>
        )}

        {/* Loading indicator */}
        {loading && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700 mx-auto"></div>
            <p className="mt-2">Loading...</p>
          </div>
        )}

        {/* Main content */}
        {!loading && (
          <div>
            {unlockTime !== null && (
              <div className="mb-4 p-4 bg-gray-50 rounded">
                <p className="text-lg">
                  🔐 <strong>Unlock Time:</strong>{" "}
                  {new Date(Number(unlockTime) * 1000).toLocaleString()}
                </p>
                <p className="mt-2">
                  {canWithdraw
                    ? "✅ Funds are available for withdrawal"
                    : "⏱ Funds are still locked"}
                </p>
              </div>
            )}

            {!isConnected ? (
              <div className="text-center py-4">
                <p className="mb-4">Connect your wallet to interact with the vault</p>
                <button
                  onClick={testConfiguration}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded"
                  disabled={loading}
                >
                  Test Connection
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <button
                  onClick={canWithdraw ? handleWithdraw : fetchUnlockTime}
                  className={`px-6 py-2 rounded text-white font-medium ${
                    canWithdraw
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                  disabled={loading || !isConfigured}
                >
                  {canWithdraw ? "Withdraw" : "Check Status"}
                </button>

                {txHash && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded w-full text-center">
                    <p>✅ Transaction submitted</p>
                    <p className="mt-2 text-sm text-gray-600 break-all">TX: {txHash}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Advanced diagnostics section */}
      {showTester && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Advanced Diagnostics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded shadow-md">
              <h3 className="font-bold mb-4">MultiBaas Environment</h3>
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-medium text-gray-500">Contract Name</p>
                  <p>{process.env.NEXT_PUBLIC_MULTIBAAS_CONTRACT_NAME || "Not set"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Contract Address Alias</p>
                  <p>{process.env.NEXT_PUBLIC_MULTIBAAS_CONTRACT_ADDRESS || "Not set"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Deployment URL</p>
                  <p>{process.env.NEXT_PUBLIC_MULTIBAAS_DEPLOYMENT_URL ? "Set" : "Not set"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">API Key</p>
                  <p>{process.env.NEXT_PUBLIC_MULTIBAAS_DAPP_USER_API_KEY ? "Set (hidden)" : "Not set"}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded shadow-md">
              <h3 className="font-bold mb-4">Connection Status</h3>
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-medium text-gray-500">Wallet Connected</p>
                  <p>{isConnected ? "Yes" : "No"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Wallet Address</p>
                  <p className="truncate">{address || "None"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">MultiBaas Configured</p>
                  <p>{isConfigured ? "Yes" : "No"}</p>
                </div>
                <button
                  onClick={testConfiguration}
                  className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
                  disabled={loading}
                >
                  Refresh Status
                </button>
              </div>
            </div>
          </div>
          
          <ContractMethodTester 
            callContractRead={callContractRead} 
            onResult={(result: any) => setDebugInfo(result)} 
          />
        </div>
      )}
    </div>
  );
};

// Contract method tester component
interface ContractMethodTesterProps {
  callContractRead: (methodName: string, args: any[]) => Promise<any>;
  onResult: (result: any) => void;
}

const ContractMethodTester = ({ callContractRead, onResult }: ContractMethodTesterProps) => {
  const [methodName, setMethodName] = useState("unlockTime");
  const [args, setArgs] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const handleTest = async () => {
    setLoading(true);
    try {
      console.log(`Testing method ${methodName} with args:`, args);
      const result = await callContractRead(methodName, args);
      console.log(`Method ${methodName} result:`, result);
      onResult({
        method: methodName,
        args: args,
        result: result,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      console.error(`Method ${methodName} error:`, err);
      onResult({
        method: methodName,
        args: args,
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="mt-6 p-4 border border-gray-300 rounded bg-white shadow-md">
      <h3 className="font-bold mb-2">Contract Method Tester</h3>
      <div className="flex flex-col space-y-2">
        <input 
          type="text" 
          value={methodName}
          onChange={(e) => setMethodName(e.target.value)}
          placeholder="Method name (e.g. unlockTime)" 
          className="px-3 py-2 border border-gray-300 rounded"
        />
        <textarea
          value={JSON.stringify(args)}
          onChange={(e) => {
            try {
              setArgs(JSON.parse(e.target.value));
            } catch (error) {
              // Allow invalid JSON while typing
            }
          }}
          placeholder="Arguments as JSON array (e.g. [])"
          className="px-3 py-2 border border-gray-300 rounded h-20"
        />
        <button
          onClick={handleTest}
          disabled={loading}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded"
        >
          {loading ? "Testing..." : "Test Method"}
        </button>
      </div>
      <div className="mt-4">
        <h4 className="font-medium text-sm mb-1">Common Methods:</h4>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => {
              setMethodName("unlockTime");
              setArgs([]);
            }}
            className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-xs"
          >
            unlockTime
          </button>
          <button 
            onClick={() => {
              setMethodName("owner");
              setArgs([]);
            }}
            className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-xs"
          >
            owner
          </button>
        </div>
      </div>
    </div>
  );
};

export default Home;