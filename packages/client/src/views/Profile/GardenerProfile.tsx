import { toastService } from "@green-goods/shared";
import { useEnsAvatar, useGardenerProfile, useUser } from "@green-goods/shared/hooks";
import { resolveAvatarUrl, resolveImageUrl, uploadFileToIPFS } from "@green-goods/shared/modules";
import { RiImageAddLine, RiLoader4Line, RiSaveLine } from "@remixicon/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { Button } from "@/components/UI/Button";
import { Card } from "@/components/UI/Card/Card";
import { FormInput } from "@/components/UI/Form/Input";
import { FormText } from "@/components/UI/Form/Text";

const DEFAULT_AVATAR = "/images/avatar.png";

export const GardenerProfile: React.FC = () => {
  const intl = useIntl();
  const { profile, updateProfile, isUpdating } = useGardenerProfile();
  const { user } = useUser();
  const primaryAddress = user?.id;
  const { data: ensAvatar, isLoading: isLoadingAvatar } = useEnsAvatar(primaryAddress);

  const [formData, setFormData] = useState({
    name: profile?.name || "",
    bio: profile?.bio || "",
    location: profile?.location || "",
    imageURI: profile?.imageURI || "",
    socialLinks: profile?.socialLinks || [],
    contactInfo: profile?.contactInfo || "",
  });

  const [uploadingImage, setUploadingImage] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const imageInputId = "gardener-profile-image-upload";
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!profile) return;
    setFormData({
      name: profile.name || "",
      bio: profile.bio || "",
      location: profile.location || "",
      imageURI: profile.imageURI || "",
      socialLinks: profile.socialLinks || [],
      contactInfo: profile.contactInfo || "",
    });
  }, [profile]);

  const profileImagePreview = useMemo(() => {
    if (formData.imageURI) {
      return resolveImageUrl(formData.imageURI);
    }
    return ensAvatar || DEFAULT_AVATAR;
  }, [formData.imageURI, ensAvatar]);

  const canAddSocialLink = formData.socialLinks.length < 5;

  // Validation
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.name.length > 50) {
      newErrors.name = "Name must be 50 characters or less";
    }

    if (formData.bio.length > 280) {
      newErrors.bio = "Bio must be 280 characters or less";
    }

    if (formData.location.length > 100) {
      newErrors.location = "Location must be 100 characters or less";
    }

    if (formData.socialLinks.length > 5) {
      newErrors.socialLinks = "Maximum 5 social links allowed";
    }

    // Validate social links are https URLs
    for (const link of formData.socialLinks) {
      if (link && !link.startsWith("https://")) {
        newErrors.socialLinks = "Social links must be HTTPS URLs";
        break;
      }
    }

    // Validate image URI
    if (formData.imageURI && !isValidImageURI(formData.imageURI)) {
      newErrors.imageURI = "Image URI must start with ipfs://, ar://, or https://";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidImageURI = (uri: string): boolean => {
    return uri.startsWith("ipfs://") || uri.startsWith("ar://") || uri.startsWith("https://");
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const ipfsHash = await uploadFileToIPFS(file);
      setFormData((prev) => ({ ...prev, imageURI: `ipfs://${ipfsHash}` }));
    } catch (error) {
      console.error("Image upload failed:", error);
      toastService.error({
        title: intl.formatMessage({
          id: "app.profile.imageUploadFailedTitle",
          defaultMessage: "Image upload failed",
        }),
        message: intl.formatMessage({
          id: "app.profile.imageUploadFailedMessage",
          defaultMessage: "Please try again.",
        }),
        context: "profile image upload",
        error,
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toastService.error({
        title: intl.formatMessage({
          id: "app.profile.validationErrorsTitle",
          defaultMessage: "Please review your profile",
        }),
        message: intl.formatMessage({
          id: "app.profile.validationErrorsMessage",
          defaultMessage: "Fix the highlighted fields before saving.",
        }),
        context: "profile form validation",
        suppressLogging: true,
      });
      return;
    }

    updateProfile(formData);
  };

  const handleSocialLinkChange = (index: number, value: string) => {
    const newLinks = [...formData.socialLinks];
    newLinks[index] = value;
    setFormData((prev) => ({ ...prev, socialLinks: newLinks }));
  };

  const addSocialLink = () => {
    if (formData.socialLinks.length >= 5) {
      toastService.error({
        title: intl.formatMessage({
          id: "app.profile.socialLimitTitle",
          defaultMessage: "Limit reached",
        }),
        message: intl.formatMessage({
          id: "app.profile.socialLimitMessage",
          defaultMessage: "You can add up to five links.",
        }),
        context: "profile social links",
        suppressLogging: true,
      });
      return;
    }
    setFormData((prev) => ({ ...prev, socialLinks: [...prev.socialLinks, ""] }));
  };

  const removeSocialLink = (index: number) => {
    const newLinks = formData.socialLinks.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, socialLinks: newLinks }));
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h5 className="text-label-md text-slate-900">
        {intl.formatMessage({
          id: "app.profile.gardenerProfile",
          defaultMessage: "Gardener Profile",
        })}
      </h5>

      {/* Basic Info */}
      <Card className="flex flex-col gap-4 py-4">
        <div className="flex flex-col gap-3">
          <FormInput
            id="name"
            label={intl.formatMessage({
              id: "app.profile.name",
              defaultMessage: "Display Name",
            })}
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Alice Green"
            helperText={`${formData.name.length}/50 characters`}
            error={errors.name}
          />

          <FormText
            id="bio"
            label={intl.formatMessage({
              id: "app.profile.bio",
              defaultMessage: "Bio",
            })}
            value={formData.bio}
            onChange={(e) => setFormData((prev) => ({ ...prev, bio: e.target.value }))}
            placeholder="Passionate about regenerative agriculture..."
            rows={3}
            helperText={`${formData.bio.length}/280 characters`}
            error={errors.bio}
          />

          <FormInput
            id="location"
            label={intl.formatMessage({
              id: "app.profile.location",
              defaultMessage: "Location",
            })}
            value={formData.location}
            onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
            placeholder="Portland, Oregon"
            helperText={`${formData.location.length}/100 characters`}
            error={errors.location}
          />
        </div>
      </Card>

      {/* Profile Image */}
      <Card className="flex flex-col gap-4 py-4">
        <div className="flex flex-col gap-3">
          <p className="text-label-sm font-semibold text-slate-800">
            {intl.formatMessage({
              id: "app.profile.image",
              defaultMessage: "Profile Image",
            })}
          </p>

          {/* Show uploaded image, ENS avatar, or fallback */}
          <div className="flex justify-center">
            <div className="relative h-24 w-24">
              <img
                src={profileImagePreview}
                alt={intl.formatMessage({
                  id: "app.profile.imagePreviewAlt",
                  defaultMessage: "Profile preview",
                })}
                className="h-24 w-24 rounded-full object-cover shadow-md"
              />
              {!formData.imageURI && isLoadingAvatar && (
                <div className="absolute inset-0 rounded-full bg-slate-200/80 animate-pulse backdrop-blur-sm" />
              )}
            </div>
          </div>

          {/* Show ENS avatar source if no custom upload */}
          {!formData.imageURI && ensAvatar && (
            <p className="text-xs text-center text-slate-500">
              {intl.formatMessage({
                id: "app.profile.usingENSAvatar",
                defaultMessage: "Using ENS avatar",
              })}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              id={imageInputId}
              ref={fileInputRef}
              disabled={uploadingImage}
            />
            <Button
              type="button"
              variant="neutral"
              mode="stroke"
              size="small"
              label={
                uploadingImage
                  ? intl.formatMessage({
                      id: "app.common.uploading",
                      defaultMessage: "Uploading...",
                    })
                  : formData.imageURI
                    ? intl.formatMessage({
                        id: "app.profile.changeImage",
                        defaultMessage: "Change Image",
                      })
                    : intl.formatMessage({
                        id: "app.profile.uploadImage",
                        defaultMessage: "Upload Image",
                      })
              }
              leadingIcon={
                uploadingImage ? <RiLoader4Line className="animate-spin" /> : <RiImageAddLine />
              }
              disabled={uploadingImage}
              onClick={() => fileInputRef.current?.click()}
            />
            {formData.imageURI && (
              <Button
                type="button"
                variant="error"
                mode="stroke"
                size="small"
                label={intl.formatMessage({
                  id: "app.profile.removeImage",
                  defaultMessage: "Remove",
                })}
                onClick={() => setFormData((prev) => ({ ...prev, imageURI: "" }))}
                disabled={uploadingImage}
              />
            )}
          </div>

          {ensAvatar && !formData.imageURI && (
            <p className="text-xs text-slate-500">
              {intl.formatMessage({
                id: "app.profile.ensAvatarHint",
                defaultMessage:
                  "💡 Upload a custom image to override your ENS avatar, or leave empty to use your ENS avatar.",
              })}
            </p>
          )}

          {errors.imageURI && <p className="text-xs text-red-600">{errors.imageURI}</p>}
        </div>
      </Card>

      {/* Social Links */}
      <Card className="flex flex-col gap-4 py-4">
        <div className="flex flex-col gap-3">
          <p className="text-label-sm font-semibold text-slate-800">
            {intl.formatMessage({
              id: "app.profile.socialLinks",
              defaultMessage: "Social Links",
            })}
          </p>

          {formData.socialLinks.map((link, index) => (
            <div key={index} className="flex flex-col gap-2 sm:flex-row">
              <FormInput
                id={`social-link-${index}`}
                label={intl.formatMessage(
                  {
                    id: "app.profile.socialLinks.linkLabel",
                    defaultMessage: "Social link {index}",
                  },
                  { index: index + 1 }
                )}
                value={link}
                onChange={(e) => handleSocialLinkChange(index, e.target.value)}
                placeholder="https://twitter.com/username"
                className="flex-1"
              />
              <Button
                type="button"
                variant="error"
                mode="stroke"
                size="small"
                label={intl.formatMessage({
                  id: "app.profile.socialLinks.remove",
                  defaultMessage: "Remove",
                })}
                onClick={() => removeSocialLink(index)}
                className="sm:w-auto"
              />
            </div>
          ))}

          {canAddSocialLink && (
            <Button
              type="button"
              variant="neutral"
              mode="stroke"
              size="small"
              label={intl.formatMessage({
                id: "app.profile.addSocialLink",
                defaultMessage: "Add Social Link",
              })}
              onClick={addSocialLink}
              className="self-start"
            />
          )}

          {errors.socialLinks && <p className="text-xs text-red-600">{errors.socialLinks}</p>}
        </div>
      </Card>

      {/* Contact Info */}
      <Card className="flex flex-col gap-4 py-4">
        <FormInput
          id="contact"
          label={intl.formatMessage({
            id: "app.profile.contact",
            defaultMessage: "Contact Info",
          })}
          value={formData.contactInfo}
          onChange={(e) => setFormData((prev) => ({ ...prev, contactInfo: e.target.value }))}
          placeholder="@telegram or email@example.com"
          helperText="Optional - for garden operators to reach you"
        />
      </Card>

      {/* Submit Button */}
      <Button
        type="submit"
        variant="primary"
        mode="filled"
        size="medium"
        label={
          isUpdating
            ? intl.formatMessage({
                id: "app.common.saving",
                defaultMessage: "Saving...",
              })
            : intl.formatMessage({
                id: "app.common.save",
                defaultMessage: "Save Profile",
              })
        }
        leadingIcon={isUpdating ? <RiLoader4Line className="animate-spin" /> : <RiSaveLine />}
        disabled={isUpdating || uploadingImage}
        className="w-full"
      />

      {/* Gas Cost Info */}
      <p className="text-xs text-slate-500 text-center">
        {intl.formatMessage({
          id: "app.profile.gasless",
          defaultMessage: "✨ Profile updates are gasless (sponsored by Pimlico)",
        })}
      </p>
    </form>
  );
};
