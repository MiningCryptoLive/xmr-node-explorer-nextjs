import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from 'lib/prisma';
import { updateNodes } from './nodeService';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'DELETE') {
    deleteHandler(req, res);
  } else {
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

const deleteHandler = async (
  req: NextApiRequest,
  res: NextApiResponse<number>
) => {
  const authorizationHeader = req.headers['Authorization'];

  if (authorizationHeader !== `Bearer ${process.env.API_SECRET_KEY}`) {
    res.status(401).end('Unauthorized');
    return;
  }

  try {
    // first update the nodes
    const nodes = await prisma.node.findMany({});
    await updateNodes(nodes);
    // deletes nodes that haven't been seen in the last seven days
    const { count } = await prisma.node.deleteMany({
      where: {
        lastSeen: {
          lt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
        },
      },
    });
    console.log(
      count === 0 ? `No nodes were deleted` : `Deleted ${count} nodes`
    );
    res.status(200).json(count);
  } catch (error) {
    console.warn(error);
    res.status(500).json(0);
  }
};
