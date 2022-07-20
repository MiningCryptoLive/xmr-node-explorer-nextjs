import { Network, Node } from '@prisma/client';
import axios, { AxiosError } from 'axios';
import { prisma } from 'lib/prisma';

export interface IInfo {
  height: number;
  nettype: string;
  status: string;
  version: string;
}

interface IGetNodeInfo {
  info: IInfo;
  ip: string;
}

export const getNodeInfo = async (
  node: Partial<Node>
): Promise<IGetNodeInfo | null> => {
  try {
    const host = node.url || node.ip;
    const url = `http://${host}:${node.port}/json_rpc`;
    const response = await axios.post(
      url,
      {
        jsonrpc: '2.0',
        id: '0',
        method: 'get_info',
        contentType: 'application/json',
      },
      {
        timeout: 2000,
      }
    );

    if (response.data.error) {
      console.warn(response.data.error);
      return null;
    }

    if (response?.data?.result) {
      return {
        info: response.data.result,
        ip: response.request.socket.remoteAddress,
      };
    }

    return null;
  } catch (error) {
    console.warn(error);
    if (axios.isAxiosError(error)) {
      const serverError = error as AxiosError;
      if (serverError && serverError.response) {
        console.warn(serverError.response.data);
      }
    }
    return null;
  }
};

interface IWhiteListPeersGeneral {
  host: string;
  id: number;
  ip: number;
  last_seen: number;
  port: number;
  rpc_port?: number;
}

export const findNodePeers = async (id: number): Promise<Partial<Node>[]> => {
  const startNode = await prisma.node.findUnique({
    where: { id },
  });
  if (!startNode) {
    return [];
  }
  const { url, port } = startNode;
  try {
    const response = await axios.post(`http://${url}:${port}/get_peer_list`);
    if (response?.data?.status === 'OK') {
      const { white_list }: { white_list: IWhiteListPeersGeneral[] } =
        response.data;
      const nodes = white_list
        .filter((peer) => peer.rpc_port)
        .map((peer) => {
          return {
            ip: peer.host,
            port: peer.rpc_port,
          };
        });
      const addedNodes = [];
      for (const node of nodes) {
        const result = await getNodeInfo(node);
        if (result) {
          const { info, ip } = result;
          const { height, nettype } = info;
          let network;
          if (nettype === 'mainnet') {
            network = Network.MAINNET;
          } else if (nettype === 'testnet') {
            network = Network.TESTNET;
          } else {
            network = Network.STAGENET;
          }
          if (info.status === 'OK') {
            addedNodes.push({
              ip: ip,
              port: node.port,
              height: height,
              network: network,
              lastSeen: new Date(),
              url: ip,
              country: 'unknown',
            });
            console.log('Added node');
          }
        }
      }
      return addedNodes;
    }
    return [];
  } catch (error) {
    console.warn(error);
    throw error;
  }
};
