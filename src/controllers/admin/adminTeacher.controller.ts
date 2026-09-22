import { Response } from "express";
import TeacherInfo from "../../models/teacherInfo.model";
import { AuthRequest } from "../../middleware/auth.middleware";

export const getAdminTeacherInfo = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    let info = await TeacherInfo.findOne();
    if (!info) {
      info = await TeacherInfo.create({
        name: "Admin Sir",
        title: "Meet the Minds Behind Speed Education",
        designation: "Founder & Chief Instructor",
        imageUrl: "",
        bio: "Dedicated to shaping future officers & leaders with Speed Education.",
      });
    }
    res.status(200).json(info);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch teacher info", error });
  }
};

export const updateAdminTeacherInfo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, title, designation, imageUrl, bio } = req.body;
    let info = await TeacherInfo.findOne();
    if (info) {
      info.name = name ?? info.name;
      info.title = title ?? info.title;
      info.designation = designation ?? info.designation;
      info.imageUrl = imageUrl ?? info.imageUrl;
      info.bio = bio ?? info.bio;
      await info.save();
    } else {
      info = await TeacherInfo.create({
        name: name || "Admin Sir",
        title: title || "Meet the Minds Behind Speed Education",
        designation: designation || "Founder & Chief Instructor",
        imageUrl: imageUrl || "",
        bio: bio || "",
      });
    }
    res.status(200).json(info);
  } catch (error) {
    res.status(500).json({ message: "Failed to update teacher info", error });
  }
};
