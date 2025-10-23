import { useGardenerProfile } from "@green-goods/shared/hooks";
import { uploadFileToIPFS } from "@green-goods/shared/modules";
import { RiImageAddLine, RiLoader4Line, RiSaveLine } from "@remixicon/react";
import { toastService } from "@green-goods/shared";
import { useState } from "react";
import { useIntl } from "react-intl";
import { Button } from "@/components/UI/Button";
import { Card } from "@/components/UI/Card/Card";
import { FormInput } from "@/components/UI/Form/Input";
import { FormText } from "@/components/UI/Form/Text";

export const GardenerProfile: React.FC = () => {
  const intl = useIntl();
  const { profile, updateProfile, isUpdating } = useGardenerProfile();

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
      <h5>
        {intl.formatMessage({
          id: "app.profile.gardenerProfile",
          defaultMessage: "Gardener Profile",
        })}
      </h5>

      {/* Basic Info */}
      <Card>
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
      <Card>
        <div className="flex flex-col gap-3">
          <label className="font-semibold text-slate-800">
            {intl.formatMessage({
              id: "app.profile.image",
              defaultMessage: "Profile Image",
            })}
          </label>

          {formData.imageURI && (
            <div className="flex justify-center">
              <img
                src={formData.imageURI.replace(
                  "ipfs://",
                  "https://greengoods.mypinata.cloud/ipfs/"
                )}
                alt="Profile"
                className="w-24 h-24 rounded-full object-cover"
              />
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              id="image-upload"
              disabled={uploadingImage}
            />
            <label htmlFor="image-upload">
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
                    : intl.formatMessage({
                        id: "app.profile.uploadImage",
                        defaultMessage: "Upload Image",
                      })
                }
                leadingIcon={
                  uploadingImage ? <RiLoader4Line className="animate-spin" /> : <RiImageAddLine />
                }
                disabled={uploadingImage}
                onClick={() => document.getElementById("image-upload")?.click()}
              />
            </label>
          </div>

          {errors.imageURI && <p className="text-xs text-red-600">{errors.imageURI}</p>}
        </div>
      </Card>

      {/* Social Links */}
      <Card>
        <div className="flex flex-col gap-3">
          <label className="font-semibold text-slate-800">
            {intl.formatMessage({
              id: "app.profile.socialLinks",
              defaultMessage: "Social Links",
            })}
          </label>

          {formData.socialLinks.map((link, index) => (
            <div key={index} className="flex gap-2">
              <FormInput
                id={`social-link-${index}`}
                label=""
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
                label="Remove"
                onClick={() => removeSocialLink(index)}
              />
            </div>
          ))}

          {formData.socialLinks.length < 5 && (
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
            />
          )}

          {errors.socialLinks && <p className="text-xs text-red-600">{errors.socialLinks}</p>}
        </div>
      </Card>

      {/* Contact Info */}
      <Card>
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
