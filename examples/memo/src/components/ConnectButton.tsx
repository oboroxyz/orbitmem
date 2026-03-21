import { useState } from "react";
import {
  Button,
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { useAccount, useConnect, useDisconnect } from "wagmi";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const [isOpen, setIsOpen] = useState(false);

  if (isConnected) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm font-mono text-gray-600">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </span>
        <Button
          onPress={() => disconnect()}
          className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 transition-colors cursor-pointer"
        >
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button className="px-3 py-1.5 border-2 transition-colors cursor-pointer hover:bg-gray-100">
        Connect Wallet
      </Button>
      <ModalOverlay isDismissable className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
        <Modal className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
          <Dialog className="outline-none">
            <Heading slot="title" className="text-lg font-semibold mb-4">
              Connect Wallet
            </Heading>
            <div className="flex flex-col gap-3">
              {connectors.map((connector) => (
                <Button
                  key={connector.uid}
                  onPress={() => {
                    connect({ connector });
                    setIsOpen(false);
                  }}
                  className="flex items-center gap-3 px-4 py-2.5 border hover:bg-gray-100 transition-colors text-left cursor-pointer"
                >
                  {connector.icon ? (
                    <img src={connector.icon} alt="" className="w-6 h-6 rounded" />
                  ) : (
                    <span className="w-6 h-6 flex items-center justify-center text-base">🌐</span>
                  )}
                  {connector.name}
                </Button>
              ))}
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
