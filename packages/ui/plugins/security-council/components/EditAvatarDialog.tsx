import { Dialog, DialogContent, DialogRoot, DialogHeader, DialogFooter } from "@aragon/ods";
import { useState } from "react";
import { useAccount } from "wagmi";
import { Button } from "@aragon/ods";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { uploadFileToPinata, resolveIpfsImage } from "@/utils/ipfs";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAnnounceDelegation } from "../../delegates/hooks/useAnnounceDelegation";
import { useDelegateAnnounce } from "../../delegates/hooks/useDelegateAnnounce";
import { IAnnouncementMetadata } from "../../delegates/utils/types";

interface EditAvatarDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}

const MetadataSchema = z.object({
  identifier: z.string().default(""),
  bio: z.string().default(""),
  message: z.string().default(""),
  resources: z.array(z.object({ name: z.string().optional(), link: z.string().optional() })).optional().default([]),
  avatar: z.string().url({ message: "Avatar must be a valid URL" }).optional(),
});

export function EditAvatarDialog({ open, onClose, onSave }: EditAvatarDialogProps) {
  const { address: currentUserAddress } = useAccount();
  const { announce } = useDelegateAnnounce(currentUserAddress);
  const [localAvatarPreview, setLocalAvatarPreview] = useState<string | undefined>(undefined);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const {
    setValue,
    watch,
    formState: { errors },
    handleSubmit,
  } = useForm<z.infer<typeof MetadataSchema>>({
    resolver: zodResolver(MetadataSchema),
    mode: "onTouched",
    defaultValues: {
      avatar: announce?.avatar || "", // 👈 add this line
    },
  });

  const onSuccessfulAnnouncement = () => {
    onClose();
    onSave();
  };

  const { isConfirming, status, announceDelegation } = useAnnounceDelegation(onSuccessfulAnnouncement);
  const handleAnnouncement = async (values: z.infer<typeof MetadataSchema>) => {
    announceDelegation({
      ...values,
      resources: values.resources?.filter((r) => !!r.link && !!r.name) as IAnnouncementMetadata["resources"],
    });
  };

  const ctaLabel = isConfirming
  ? "Updating"
  : status === "pending"
    ? "Waiting for confirmation"
    : "Update";

  return (
    <DialogRoot open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogHeader title="Edit Avatar" />
      <DialogContent>
      <div className="flex flex-col items-center gap-3">
          <div className="relative">
            {localAvatarPreview || watch("avatar") ? (
              <img
                src={localAvatarPreview || resolveIpfsImage(watch("avatar"))}
                alt="Avatar preview"
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400">
                No Avatar
              </div>
            )}

            {isUploadingAvatar && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-full">
                <div className="h-6 w-6 animate-spin border-2 border-gray-400 border-t-transparent rounded-full" />
              </div>
            )}
          </div>

          <label className="cursor-pointer text-sm text-blue-600 underline">
            Upload Avatar
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                if (e.target.files && e.target.files[0]) {
                  const file = e.target.files[0];
                  const max_avatar_size_bytes = 1 * 1024 * 1024;
                  if (file.size > max_avatar_size_bytes) {
                    alert(`Avatar image is too large. Max size is ${1}MB.`);
                    return;
                  }

                  const localUrl = URL.createObjectURL(file);
                  setLocalAvatarPreview(localUrl);

                  setIsUploadingAvatar(true);

                  try {
                    const ipfsUri = await uploadFileToPinata(file); // your function from ipfs.ts
                    setValue("avatar", ipfsUri);
                    setLocalAvatarPreview(undefined);
                  } catch (error) {
                    console.error(error);
                  } finally {
                    setIsUploadingAvatar(false);
                  }
                }
              }}
            />
          </label>

          {errors.avatar?.message && (
            <p className="text-sm text-red-500">{errors.avatar.message}</p>
          )}

          {isUploadingAvatar && (
            <p className="text-sm text-neutral-400">Uploading avatar...</p>
          )}
        </div>

        <div className="mt-4 flex justify-between">
          <Button variant="secondary" size="lg" onClick={onClose} disabled={isConfirming || status === "pending"}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="lg"
            isLoading={isConfirming || status === "pending"}
            onClick={handleSubmit(handleAnnouncement)}
          >
            {ctaLabel}
          </Button>
        </div>
        
      </DialogContent>
      <DialogFooter />
    </DialogRoot>
  );
}
